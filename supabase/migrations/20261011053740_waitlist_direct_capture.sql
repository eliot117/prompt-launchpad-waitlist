-- Direct capture is not proof of inbox ownership. Preserve legacy verification,
-- referral credits and opt-outs; do not enqueue mail or award new referral credit.
alter table public.waitlist add column joined_at timestamptz;
comment on column public.waitlist.joined_at is
  'Time the address was accepted through direct signup. Does not establish inbox ownership. Active direct captures require unsubscribed_at IS NULL.';

create function public.request_waitlist_capture(p_email text,p_referred_by text,p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_email text:=lower(btrim(p_email));
  v_row public.waitlist%rowtype;
  v_ref text;
  v_constraint text;
  v_try integer;
  v_request_count bigint;
  v_oldest_request timestamptz;
  v_retry_after integer;
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

  -- Use the same lock namespace/log as the legacy signup path. Every accepted
  -- valid request consumes quota, so quota behaviour cannot reveal row existence.
  perform pg_advisory_xact_lock(hashtextextended('waitlist:ip:'||p_ip_hash,0));
  select count(*),min(created_at) into v_request_count,v_oldest_request
    from public.waitlist_request_log where ip_hash=p_ip_hash and created_at>now()-interval '1 hour';
  if v_request_count>=3 then
    v_retry_after:=greatest(1,least(3600,ceil(extract(epoch from (v_oldest_request+interval '1 hour'-now())))::integer));
    return jsonb_build_object('status','rate_limited','retry_after',v_retry_after);
  end if;
  insert into public.waitlist_request_log(ip_hash) values(p_ip_hash);

  perform pg_advisory_xact_lock(hashtextextended('waitlist:email:'||v_email,0));
  select * into v_row from public.waitlist where email=v_email for update;
  if found then
    -- A repeated form submission is not permission to reactivate an opted-out
    -- address. Preserve first capture time and existing attribution on duplicates.
    if v_row.unsubscribed_at is null and v_row.joined_at is null then
      update public.waitlist set joined_at=now(),consent_recorded_at=now(),consent_version='waitlist-direct-v2'
        where id=v_row.id;
    end if;
    return jsonb_build_object('status','accepted');
  end if;

  select referral_code into v_ref from public.waitlist
    where referral_code=nullif(upper(btrim(p_referred_by)),'') and email<>v_email and unsubscribed_at is null;
  -- The existing BEFORE INSERT trigger assigns the share code and validates
  -- attribution. Retry the rare concurrent share-code collision without changing
  -- the email uniqueness requirement or deleting any data.
  for v_try in 1..5 loop
    begin
      insert into public.waitlist(id,email,referral_code,referral_count,referred_by,joined_at,consent_recorded_at,consent_version)
        values(gen_random_uuid(),v_email,null,0,v_ref,now(),now(),'waitlist-direct-v2') returning * into v_row;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint=CONSTRAINT_NAME;
      if v_constraint not in ('waitlist_referral_code_key','waitlist_hardened_referral_code_unique') or v_try=5 then raise; end if;
    end;
  end loop;
  return jsonb_build_object('status','accepted');
end $$;

revoke all on function public.request_waitlist_capture(text,text,text) from public,anon,authenticated;
grant execute on function public.request_waitlist_capture(text,text,text) to service_role;
comment on function public.request_waitlist_capture(text,text,text) is
  'Service gateway only. Direct signup with atomic quota, generic response, no email verification, email jobs or referral credit. Never reactivates opt-outs.';

-- Leave waitlist_count verified-only: counting direct captures would let a caller
-- infer stored email existence by comparing public counts around a signup.
