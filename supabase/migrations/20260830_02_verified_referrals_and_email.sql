-- Referral production-readiness, part 2 of 2: logic.
--
-- Three things change:
--   1. A referral is no longer counted on insert. The AFTER INSERT trigger is
--      retired and counting moves into verify_email, so a referral only counts
--      once the referred person has proven they control the inbox.
--   2. join_waitlist rate-limits by caller IP (3 per rolling hour) and sends a
--      verification email via pg_net -> Resend.
--   3. verify_email is the sole crediting path.
--
-- Secrets live in Supabase Vault under the names RESEND_API_KEY,
-- RESEND_FROM_EMAIL and (optionally) SITE_URL. Nothing is hardcoded, and every
-- email path is a no-op while those are unset, so signup keeps working before
-- Resend is configured.

-- ---------------------------------------------------------------- helpers --

-- PostgREST exposes the request headers to the database session, which is what
-- makes per-IP rate limiting possible inside the RPC with no edge function and
-- no extra network hop.
create or replace function public.caller_ip()
returns inet
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
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
$function$;

comment on function public.caller_ip() is
  'Best-effort caller IP from the PostgREST request headers. Returns null when unknown; callers fail open on null, because a missing header must never cost a real person their signup.';

-- A client-supplied origin is only trusted when nothing better is configured,
-- and only in a strict http(s)://host[:port] shape. Otherwise anyone calling
-- the RPC directly could aim a real verification email at a domain they own.
create or replace function public.resolve_origin(p_origin text)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
$function$;

comment on function public.resolve_origin(text) is
  'Trusted base URL for emailed links. A Vault SITE_URL always wins over the client-supplied origin; without one, the origin is accepted only in a strict http(s)://host[:port] shape.';

create or replace function public.send_email(p_to text, p_subject text, p_html text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- Async by design: net.http_post queues the request and returns immediately,
  -- so a slow or unreachable Resend never holds up the signup transaction.
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
$function$;

comment on function public.send_email(text, text, text) is
  'Sends one transactional email through Resend via pg_net. No-ops (with a notice) while the Vault secrets are unset.';

create or replace function public.send_verification_email(p_email text, p_token text, p_origin text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
$function$;

create or replace function public.send_confirmation_email(p_email text, p_referral_code text, p_origin text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_link text;
begin
  if coalesce(p_origin, '') = '' then
    raise notice 'send_confirmation_email skipped: no trusted origin to build a link from';
    return;
  end if;

  -- The same link the site builds for this person. Emailing it is what makes
  -- it durable: localStorage only exists on the browser they signed up on.
  v_link := p_origin || '/?ref=' || p_referral_code;

  perform public.send_email(
    p_email,
    'You are on the Prompt Launchpad waitlist',
    '<p>Your email is confirmed. You are on the waitlist.</p>'
    || '<p>Share your personal referral link to move up the list: <a href="' || v_link || '">' || v_link || '</a></p>'
  );
end;
$function$;

-- ------------------------------------------------------- counting moves ----
-- Retired: counting a referral the instant a row is inserted is exactly the
-- behaviour email verification exists to replace. verify_email owns it now.
drop trigger if exists waitlist_after_insert_trg on public.waitlist;
drop function if exists public.waitlist_after_insert();

-- ------------------------------------------------------- join_waitlist -----
-- Dropped rather than replaced: the added p_origin argument would otherwise
-- leave a two-argument overload behind and make the PostgREST call ambiguous.
drop function if exists public.join_waitlist(text, text);

create or replace function public.join_waitlist(
  p_email       text,
  p_referred_by text default null,
  p_origin      text default null
)
returns table(
  referral_code  text,
  referral_count integer,
  already_joined boolean,
  email_verified boolean
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- Rate limit. Fails open on an unknown IP, and is checked before any lookup
  -- so a blocked caller learns nothing about which addresses already exist.
  if v_ip is not null and (
    select count(*) from public.signup_attempts a
     where a.ip = v_ip and a.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  select * into v_row from public.waitlist w where w.email = v_email;

  if found then
    -- Already on the list: never insert again, never count again. The one
    -- thing worth doing is reissuing verification when theirs has lapsed --
    -- otherwise an unverified row is a dead end with no way to complete it.
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

  -- Logged only for calls that did real work, so an honest double-submit on an
  -- address already on the list never burns the hourly allowance.
  if v_ip is not null then
    insert into public.signup_attempts (ip) values (v_ip);
  end if;

  perform public.send_verification_email(v_row.email, v_token, v_origin);

  return query select v_row.referral_code, v_row.referral_count, false, v_row.email_verified;
end;
$function$;

comment on function public.join_waitlist(text, text, text) is
  'Creates a waitlist row and emails a verification link. Rate limited to 3 signups per IP per hour. Counts no referrals -- verify_email does that.';

-- -------------------------------------------------------- verify_email -----
create or replace function public.verify_email(
  p_token  text,
  p_origin text default null
)
returns table(
  status         text,
  referral_code  text,
  referral_count integer
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- "and not email_verified" is what makes this safe to call twice: a second
  -- click, or a concurrent one, updates zero rows and skips the counting below.
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

  -- The one and only place a referral is ever counted.
  --
  -- Deliberately checks nothing whatsoever about the referrer: not their own
  -- verification state, and not any future early-access or account tier. A
  -- referrer earns credit for the people they bring in whether or not they
  -- have been let into the product yet, and that credit sits on their
  -- permanent waitlist row until whatever grants early access reads it.
  -- Adding any condition on the referrer here would silently break that.
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
$function$;

comment on function public.verify_email(text, text) is
  'Marks a signup verified and credits its referrer exactly once. The only place referral_count is ever incremented, and it never conditions on the referrer own status.';

-- -------------------------------------------------------------- grants -----
revoke all on function public.caller_ip()                               from public;
revoke all on function public.resolve_origin(text)                      from public;
revoke all on function public.send_email(text, text, text)              from public;
revoke all on function public.send_verification_email(text, text, text) from public;
revoke all on function public.send_confirmation_email(text, text, text) from public;

revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text)
  to anon, authenticated, service_role;

revoke all on function public.verify_email(text, text) from public;
grant execute on function public.verify_email(text, text)
  to anon, authenticated, service_role;
