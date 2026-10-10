-- Read-only production schema evidence captured after restore, 2026-10-10.
-- Not a migration. Does not contain subscriber rows or secret values.

CREATE OR REPLACE FUNCTION public.caller_ip()
 RETURNS inet
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_headers json;
  v_raw     text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;

  if v_headers is null then
    return null;
  end if;

  -- x-forwarded-for is "client, proxy1, proxy2"; the client is the first entry.
  v_raw := btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1));
  if v_raw = '' then
    v_raw := btrim(coalesce(v_headers ->> 'cf-connecting-ip', ''));
  end if;
  if v_raw = '' then
    return null;
  end if;

  begin
    return v_raw::inet;
  exception when others then
    return null;
  end;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  chars    text    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code     text;
  i        integer;
  attempts integer := 0;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.waitlist w where w.referral_code = code
    );

    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'could not generate a unique referral code after 50 attempts';
    end if;
  end loop;

  return code;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_waitlist_status(p_email text, p_referral_code text)
 RETURNS TABLE(referral_code text, referral_count integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select w.referral_code, w.referral_count
    from public.waitlist w
   where w.email = lower(btrim(p_email))
     and w.referral_code = upper(btrim(p_referral_code));
$function$
;

CREATE OR REPLACE FUNCTION public.join_waitlist(p_email text, p_referred_by text DEFAULT NULL::text, p_origin text DEFAULT NULL::text)
 RETURNS TABLE(referral_code text, referral_count integer, already_joined boolean, email_verified boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email  text := lower(btrim(p_email));
  v_ip     inet := public.caller_ip();
  v_origin text := public.resolve_origin(p_origin);
  v_row    public.waitlist%rowtype;
  v_token  text;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  if v_ip is not null and (
    select count(*) from public.signup_attempts a
     where a.ip = v_ip and a.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  select * into v_row from public.waitlist w where w.email = v_email;

  if found then
    if not v_row.email_verified
       and (v_row.verification_expires_at is null or v_row.verification_expires_at < now())
    then
      v_token := encode(extensions.gen_random_bytes(24), 'hex');

      update public.waitlist
         set verification_token      = v_token,
             verification_expires_at = now() + interval '24 hours'
       where id = v_row.id
      returning * into v_row;

      if v_ip is not null then
        insert into public.signup_attempts (ip) values (v_ip);
      end if;
      perform public.send_verification_email(v_row.email, v_token, v_origin);
    end if;

    return query select v_row.referral_code, v_row.referral_count, true, v_row.email_verified;
    return;
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.waitlist (email, referred_by, verification_token, verification_expires_at)
  values (v_email, p_referred_by, v_token, now() + interval '24 hours')
  returning * into v_row;

  if v_ip is not null then
    insert into public.signup_attempts (ip) values (v_ip);
  end if;

  perform public.send_verification_email(v_row.email, v_token, v_origin);

  return query select v_row.referral_code, v_row.referral_count, false, v_row.email_verified;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_origin(p_origin text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_configured text;
  v_candidate  text;
begin
  select decrypted_secret into v_configured
    from vault.decrypted_secrets where name = 'SITE_URL' limit 1;

  v_configured := rtrim(btrim(coalesce(v_configured, '')), '/');
  if v_configured <> '' then
    return v_configured;
  end if;

  v_candidate := rtrim(btrim(coalesce(p_origin, '')), '/');
  if v_candidate ~ '^https?://[A-Za-z0-9._:-]+$' then
    return v_candidate;
  end if;

  return '';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_confirmation_email(p_email text, p_referral_code text, p_origin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_link text;
begin
  if coalesce(p_origin, '') = '' then
    raise notice 'send_confirmation_email skipped: no trusted origin to build a link from';
    return;
  end if;

  v_link := p_origin || '/?ref=' || p_referral_code;

  perform public.send_email(
    p_email,
    'You are on the Prompt Launchpad waitlist',
    '<p>Your email is confirmed. You are on the waitlist.</p>'
    || '<p>Share your personal referral link to move up the list: <a href="' || v_link || '">' || v_link || '</a></p>'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_email(p_to text, p_subject text, p_html text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_key  text;
  v_from text;
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'RESEND_API_KEY' limit 1;
  select decrypted_secret into v_from
    from vault.decrypted_secrets where name = 'RESEND_FROM_EMAIL' limit 1;

  -- Resend not configured yet. Deliberately a no-op rather than an exception:
  -- an unset key must not turn every signup into a failed signup.
  if coalesce(v_key, '') = '' or coalesce(v_from, '') = '' then
    raise notice 'send_email skipped: RESEND_API_KEY / RESEND_FROM_EMAIL are not set in Vault';
    return;
  end if;

  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    body    := jsonb_build_object(
                 'from',    v_from,
                 'to',      jsonb_build_array(p_to),
                 'subject', p_subject,
                 'html',    p_html
               ),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    timeout_milliseconds := 8000
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_verification_email(p_email text, p_token text, p_origin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_link text;
begin
  if coalesce(p_origin, '') = '' then
    raise notice 'send_verification_email skipped: no trusted origin to build a link from';
    return;
  end if;

  v_link := p_origin || '/verify?token=' || p_token;

  perform public.send_email(
    p_email,
    'Confirm your email for Prompt Launchpad',
    '<p>Thanks for joining the Prompt Launchpad waitlist.</p>'
    || '<p>Confirm your email to lock in your spot: <a href="' || v_link || '">' || v_link || '</a></p>'
    || '<p>This link expires in 24 hours. If you did not sign up, you can ignore this email.</p>'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_email(p_token text, p_origin text DEFAULT NULL::text)
 RETURNS TABLE(status text, referral_code text, referral_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row    public.waitlist%rowtype;
  v_id     uuid;
  v_origin text := public.resolve_origin(p_origin);
begin
  select * into v_row from public.waitlist w
   where w.verification_token = btrim(coalesce(p_token, ''));

  if not found then
    return query select 'invalid'::text, null::text, null::integer;
    return;
  end if;

  if v_row.email_verified then
    return query select 'already_verified'::text, v_row.referral_code, v_row.referral_count;
    return;
  end if;

  if v_row.verification_expires_at is null or v_row.verification_expires_at < now() then
    return query select 'expired'::text, null::text, null::integer;
    return;
  end if;

  v_id := v_row.id;

  update public.waitlist w
     set email_verified = true,
         verified_at    = now()
   where w.id = v_id
     and not w.email_verified
  returning * into v_row;

  if not found then
    select * into v_row from public.waitlist w where w.id = v_id;
    return query select 'already_verified'::text, v_row.referral_code, v_row.referral_count;
    return;
  end if;

  -- The one and only place a referral is ever counted. Deliberately checks
  -- nothing whatsoever about the referrer: not their own verification state,
  -- and not any future early-access or account tier.
  --
  -- Aliased, and qualified on both sides: this function returns OUT columns
  -- named referral_code / referral_count, which otherwise shadow the table.
  if v_row.referred_by is not null then
    update public.waitlist w
       set referral_count = w.referral_count + 1
     where w.referral_code = v_row.referred_by;
  end if;

  perform public.send_confirmation_email(v_row.email, v_row.referral_code, v_origin);

  return query select 'verified'::text, v_row.referral_code, v_row.referral_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.waitlist_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.email := lower(btrim(new.email));

  if new.referral_code is null then
    new.referral_code := public.generate_referral_code();
  end if;

  -- A referral code that resolves to nobody is dropped, not rejected. A bad
  -- ?ref= in a shared URL must never cost someone their signup.
  if new.referred_by is not null then
    new.referred_by := upper(btrim(new.referred_by));

    if new.referred_by = '' then
      new.referred_by := null;
    elsif new.referred_by = new.referral_code then
      new.referred_by := null;
    elsif not exists (
      select 1 from public.waitlist w where w.referral_code = new.referred_by
    ) then
      new.referred_by := null;
    end if;
  end if;

  -- Server-assigned. Client-supplied values are always discarded.
  new.referral_count := 0;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.waitlist_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select count(*)::integer from public.waitlist;
$function$
;

-- Constraints:
-- signup_attempts.signup_attempts_pkey: PRIMARY KEY (id)
-- waitlist.waitlist_email_format: CHECK ((email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text))
-- waitlist.waitlist_email_key: UNIQUE (email)
-- waitlist.waitlist_no_self_referral: CHECK (((referred_by IS NULL) OR (referred_by <> referral_code)))
-- waitlist.waitlist_pkey: PRIMARY KEY (id)
-- waitlist.waitlist_referral_code_format: CHECK ((referral_code ~ '^[A-Z0-9]{8}$'::text))
-- waitlist.waitlist_referral_code_key: UNIQUE (referral_code)
-- waitlist.waitlist_referral_count_non_negative: CHECK ((referral_count >= 0))
-- waitlist.waitlist_referred_by_format: CHECK (((referred_by IS NULL) OR (referred_by ~ '^[A-Z0-9]{8}$'::text)))
-- waitlist.waitlist_verification_token_key: UNIQUE (verification_token)

-- Triggers:
CREATE TRIGGER waitlist_before_insert_trg BEFORE INSERT ON public.waitlist FOR EACH ROW EXECUTE FUNCTION waitlist_before_insert();
