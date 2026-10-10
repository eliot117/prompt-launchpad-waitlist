-- Pending signups must not change the public aggregate: otherwise comparing
-- counts before/after signup can reveal whether an email is already stored.
-- Requires the earlier hardening migration; no subscriber data is modified.
create or replace function public.waitlist_count()
returns bigint
language sql
stable
security definer
set search_path=''
as $$
  select count(*) from public.waitlist
  where email_verified and unsubscribed_at is null
$$;

comment on function public.waitlist_count() is
  'Public count of verified, subscribed entries only. Pending signup requests cannot change this aggregate.';
revoke all on function public.waitlist_count() from public;
grant execute on function public.waitlist_count() to anon, authenticated, service_role;
