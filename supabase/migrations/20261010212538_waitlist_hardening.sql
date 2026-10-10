-- Apply as one transaction. Existing records/credits are never deleted or merged.
-- Aborts on unexpected schema/data instead of guessing how to repair production.
do $$
declare v record;
begin
  if to_regclass('public.waitlist') is null then
    raise exception 'waitlist_missing: restore/inspect the existing database before applying';
  end if;
  for v in select * from (values ('id','uuid'),('email','text'),('referral_code','text'),
      ('referral_count','integer'),('referred_by','text'),('created_at','timestamp with time zone')) as expected(col,typ)
  loop
    if not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='waitlist' and column_name=v.col and data_type=v.typ) then
      raise exception 'waitlist_schema_mismatch: % must be %', v.col,v.typ;
    end if;
  end loop;
  if exists(select 1 from public.waitlist group by lower(btrim(email)) having count(*)>1) then
    raise exception 'canonical_email_conflict: reconcile explicitly before migration';
  end if;
  if exists(select 1 from public.waitlist where email is null or octet_length(lower(btrim(email)))>254
    or octet_length(split_part(btrim(email),'@',1))>64
    or lower(btrim(email)) !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
    or referral_code is null or referral_code !~ '^[A-Za-z0-9_-]{1,128}$'
    or referral_count is null or referral_count<0 or created_at is null) then
    raise exception 'legacy_waitlist_data_requires_review';
  end if;
end $$;

lock table public.waitlist in access exclusive mode;
drop trigger if exists waitlist_after_insert_trg on public.waitlist;
alter table public.waitlist
  add column if not exists email_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_token text,
  add column if not exists verification_expires_at timestamptz,
  add column verification_token_hash text,
  add column unsubscribe_token_hash text,
  add column unsubscribed_at timestamptz,
  add column consent_recorded_at timestamptz,
  add column consent_version text;

update public.waitlist set email=lower(btrim(email));
update public.waitlist set verification_token_hash=encode(sha256(convert_to(verification_token,'UTF8')),'hex'),
  verification_token=null where verification_token is not null;
alter table public.waitlist alter column email set not null,
  alter column referral_code set not null, alter column referral_count set not null,
  alter column referral_count set default 0, alter column created_at set not null,
  alter column created_at set default now(),
  add constraint waitlist_email_canonical check(email=lower(btrim(email))),
  add constraint waitlist_email_bounded check(octet_length(email)<=254 and octet_length(split_part(email,'@',1))<=64
    and email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  add constraint waitlist_referral_nonnegative check(referral_count>=0);
do $$
declare v text;
begin
  foreach v in array array['email','referral_code'] loop
    if not exists(select 1 from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
      where i.indrelid='public.waitlist'::regclass and i.indisunique and i.indisvalid and i.indnkeyatts=1
        and i.indpred is null and i.indexprs is null and a.attname=v) then
      execute format('create unique index %I on public.waitlist(%I)','waitlist_hardened_'||v||'_unique',v);
    end if;
  end loop;
end $$;
create unique index waitlist_verification_hash_unique on public.waitlist(verification_token_hash) where verification_token_hash is not null;
create unique index waitlist_unsubscribe_hash_unique on public.waitlist(unsubscribe_token_hash) where unsubscribe_token_hash is not null;
create index if not exists waitlist_referred_by_idx on public.waitlist(referred_by);

create function public.waitlist_normalize_email_update() returns trigger
language plpgsql set search_path='' as $$
begin new.email:=lower(btrim(new.email)); return new; end $$;
create trigger waitlist_normalize_email_update_trg before update of email on public.waitlist
  for each row execute function public.waitlist_normalize_email_update();

create table public.waitlist_request_log(
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null check(ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index waitlist_request_log_hash_time_idx on public.waitlist_request_log(ip_hash,created_at desc);
create table public.waitlist_delivery_jobs(
  id uuid primary key default gen_random_uuid(),
  waitlist_id uuid not null references public.waitlist(id),
  kind text not null check(kind in ('verification','confirmation')),
  token text,
  unsubscribe_token text not null,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed','suppressed')),
  attempts integer not null default 0 check(attempts between 0 and 3),
  last_attempt_at timestamptz,
  provider_id text,
  created_at timestamptz not null default now(),
  provider_accepted_at timestamptz
);
create index waitlist_delivery_jobs_owner_time_idx on public.waitlist_delivery_jobs(waitlist_id,kind,created_at desc);
create table public.waitlist_referral_events(
  id uuid primary key default gen_random_uuid(),
  referred_id uuid not null unique references public.waitlist(id),
  referrer_id uuid not null references public.waitlist(id),
  created_at timestamptz not null default now(),
  check(referred_id<>referrer_id)
);
create index waitlist_referral_events_referrer_idx on public.waitlist_referral_events(referrer_id);
comment on table public.waitlist_referral_events is 'Credits awarded after this migration only. Existing referral_count values are preserved, never recomputed from this ledger.';
comment on table public.waitlist_delivery_jobs is 'Private outbox. Same job UUID is the provider idempotency key. Retries require 5-minute cooldown and stop after 3 attempts. Provider acceptance is not inbox delivery.';

-- No direct table access for visitors, even if a legacy policy still exists.
do $$
declare v text; p record;
begin
  foreach v in array array['waitlist','signup_attempts','waitlist_request_log','waitlist_delivery_jobs','waitlist_referral_events'] loop
    if to_regclass('public.'||v) is not null then
      execute format('alter table public.%I enable row level security',v);
      execute format('revoke all on table public.%I from public, anon, authenticated',v);
      for p in select policyname from pg_policies where schemaname='public' and tablename=v loop
        execute format('drop policy %I on public.%I',p.policyname,v);
      end loop;
    end if;
  end loop;
end $$;

create function public.waitlist_delivery_config() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_key text; v_from text; v_origin text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name='RESEND_API_KEY' limit 1;
  select decrypted_secret into v_from from vault.decrypted_secrets where name='RESEND_FROM_EMAIL' limit 1;
  select rtrim(btrim(decrypted_secret),'/') into v_origin from vault.decrypted_secrets where name='SITE_URL' limit 1;
  if coalesce(v_key,'')='' or coalesce(v_from,'')='' or coalesce(v_origin,'') !~ '^https://[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:[0-9]{1,5})?$' then
    raise exception 'delivery_not_configured' using errcode='22023';
  end if;
  return jsonb_build_object('api_key',v_key,'from_email',v_from,'site_url',v_origin);
end $$;

create function public.request_waitlist_signup(p_email text,p_referred_by text,p_ip_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_email text:=lower(btrim(p_email)); v_row public.waitlist%rowtype;
  v_job public.waitlist_delivery_jobs%rowtype; v_ref text; v_token text; v_unsubscribe text;
  v_constraint text; v_try integer;
begin
  if v_email is null or octet_length(v_email)>254 or octet_length(split_part(v_email,'@',1))>64
    or v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    raise exception 'invalid_email' using errcode='22023';
  end if;
  if octet_length(coalesce(p_referred_by,''))>128 then
    raise exception 'invalid_referral' using errcode='22023';
  end if;
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_rate_limit_identity' using errcode='22023';
  end if;
  -- Serialize the rolling-window check, including concurrent arrivals.
  perform pg_advisory_xact_lock(hashtextextended('waitlist:ip:'||p_ip_hash,0));
  if (select count(*) from public.waitlist_request_log where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=3 then
    return jsonb_build_object('status','rate_limited','job',null);
  end if;
  insert into public.waitlist_request_log(ip_hash) values(p_ip_hash);
  perform pg_advisory_xact_lock(hashtextextended('waitlist:email:'||v_email,0));
  select * into v_row from public.waitlist where email=v_email for update;
  if not found then
    select referral_code into v_ref from public.waitlist where referral_code=nullif(upper(btrim(p_referred_by)),'')
      and email<>v_email and unsubscribed_at is null;
    for v_try in 1..5 loop
      begin
        insert into public.waitlist(id,email,referral_code,referral_count,referred_by,consent_recorded_at,consent_version)
          values(gen_random_uuid(),v_email,null,0,v_ref,now(),'waitlist-v1') returning * into v_row;
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint=CONSTRAINT_NAME;
        if v_constraint not in ('waitlist_referral_code_key','waitlist_hardened_referral_code_unique') or v_try=5 then raise; end if;
      end;
    end loop;
  end if;
  if v_row.unsubscribed_at is not null or v_row.email_verified then
    return jsonb_build_object('status','accepted','job',null);
  end if;
  select * into v_job from public.waitlist_delivery_jobs where waitlist_id=v_row.id and kind='verification'
    order by created_at desc,id desc limit 1 for update;
  if v_row.verification_expires_at is null or v_row.verification_expires_at<=now() or v_job.id is null then
    v_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
    -- Preserve opt-out links in earlier emails when renewing verification.
    v_unsubscribe:=coalesce(v_job.unsubscribe_token,replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''));
    update public.waitlist set verification_token_hash=encode(sha256(convert_to(v_token,'UTF8')),'hex'),
      verification_expires_at=now()+interval '24 hours',
      unsubscribe_token_hash=encode(sha256(convert_to(v_unsubscribe,'UTF8')),'hex') where id=v_row.id;
    update public.waitlist_delivery_jobs set status='suppressed' where waitlist_id=v_row.id
      and kind='verification' and status<>'sent';
    insert into public.waitlist_delivery_jobs(waitlist_id,kind,token,unsubscribe_token)
      values(v_row.id,'verification',v_token,v_unsubscribe) returning * into v_job;
  end if;
  if v_job.status in ('sent','suppressed') or v_job.attempts>=3
    or v_job.last_attempt_at>now()-interval '5 minutes' then
    return jsonb_build_object('status','accepted','job',null);
  end if;
  update public.waitlist_delivery_jobs set status='sending',attempts=attempts+1,last_attempt_at=now()
    where id=v_job.id returning * into v_job;
  return jsonb_build_object('status','accepted','job',jsonb_build_object('id',v_job.id,'to',v_row.email,
    'kind',v_job.kind,'token',v_job.token,'referral_code',v_row.referral_code,'unsubscribe_token',v_job.unsubscribe_token));
end $$;

create function public.record_waitlist_delivery(p_job_id uuid,p_succeeded boolean,p_provider_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.waitlist_delivery_jobs set status=case when p_succeeded then 'sent' else 'failed' end,
    provider_id=case when p_succeeded then left(p_provider_id,200) else null end,
    provider_accepted_at=case when p_succeeded then now() else null end
    where id=p_job_id and status in ('sending','failed');
end $$;

create function public.verify_waitlist_token(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.waitlist%rowtype; v_job public.waitlist_delivery_jobs%rowtype;
  v_referrer uuid; v_unsubscribe text; v_awarded uuid; v_status text;
begin
  if p_token is null or p_token !~ '^([a-f0-9]{48}|[a-f0-9]{64})$' then return jsonb_build_object('status','invalid'); end if;
  select * into v_row from public.waitlist where verification_token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if not found or v_row.unsubscribed_at is not null then return jsonb_build_object('status','invalid'); end if;
  if v_row.verification_expires_at is null or v_row.verification_expires_at<=now() then return jsonb_build_object('status','expired'); end if;
  v_status:=case when v_row.email_verified then 'already_verified' else 'verified' end;
  if not v_row.email_verified then
    update public.waitlist set email_verified=true,verified_at=now() where id=v_row.id;
    select id into v_referrer from public.waitlist where referral_code=v_row.referred_by and id<>v_row.id and unsubscribed_at is null;
    if v_referrer is not null then
      insert into public.waitlist_referral_events(referred_id,referrer_id) values(v_row.id,v_referrer)
        on conflict(referred_id) do nothing returning id into v_awarded;
      if v_awarded is not null then update public.waitlist set referral_count=referral_count+1 where id=v_referrer; end if;
    end if;
  end if;
  select * into v_job from public.waitlist_delivery_jobs where waitlist_id=v_row.id and kind='confirmation'
    order by created_at desc,id desc limit 1 for update;
  if v_job.id is null then
    select unsubscribe_token into v_unsubscribe from public.waitlist_delivery_jobs where waitlist_id=v_row.id
      and kind='verification' order by created_at desc,id desc limit 1;
    if v_unsubscribe is null then
      v_unsubscribe:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
      update public.waitlist set unsubscribe_token_hash=encode(sha256(convert_to(v_unsubscribe,'UTF8')),'hex') where id=v_row.id;
    end if;
    insert into public.waitlist_delivery_jobs(waitlist_id,kind,unsubscribe_token)
      values(v_row.id,'confirmation',v_unsubscribe) returning * into v_job;
  end if;
  v_unsubscribe:=v_job.unsubscribe_token;
  if v_job.status in ('sent','suppressed') or v_job.attempts>=3 or v_job.last_attempt_at>now()-interval '5 minutes' then
    return jsonb_build_object('status',v_status,'referral_code',v_row.referral_code,'unsubscribe_token',v_unsubscribe,'job',null);
  end if;
  update public.waitlist_delivery_jobs set status='sending',attempts=attempts+1,last_attempt_at=now() where id=v_job.id returning * into v_job;
  return jsonb_build_object('status',v_status,'referral_code',v_row.referral_code,'unsubscribe_token',v_unsubscribe,
    'job',jsonb_build_object('id',v_job.id,'to',v_row.email,'kind',v_job.kind,'token',null,
      'referral_code',v_row.referral_code,'unsubscribe_token',v_unsubscribe));
end $$;

create function public.unsubscribe_waitlist_token(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('status','invalid'); end if;
  update public.waitlist set unsubscribed_at=coalesce(unsubscribed_at,now()),verification_token_hash=null,
    verification_expires_at=null where unsubscribe_token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') returning id into v_id;
  if v_id is null then return jsonb_build_object('status','invalid'); end if;
  update public.waitlist_delivery_jobs set status='suppressed' where waitlist_id=v_id and status<>'sent';
  return jsonb_build_object('status','unsubscribed');
end $$;

-- Lock down every overload, including legacy mail helpers. Public share codes never authenticate.
do $$
declare v record;
begin
  for v in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('join_waitlist','verify_email','get_waitlist_status','caller_ip',
      'resolve_origin','send_email','send_verification_email','send_confirmation_email','waitlist_delivery_config',
      'request_waitlist_signup','record_waitlist_delivery','verify_waitlist_token','unsubscribe_waitlist_token',
      'waitlist_normalize_email_update','waitlist_before_insert','generate_referral_code')
  loop
    execute format('revoke all on function %s from public, anon, authenticated',v.signature);
    execute format('grant execute on function %s to service_role',v.signature);
  end loop;
end $$;

-- Aggregate only, no email addresses or individual signup status.
drop function if exists public.waitlist_count();
create function public.waitlist_count() returns bigint language sql stable security definer set search_path=''
  as $$ select count(*) from public.waitlist where unsubscribed_at is null $$;
revoke all on function public.waitlist_count() from public;
grant execute on function public.waitlist_count() to anon,authenticated,service_role;
