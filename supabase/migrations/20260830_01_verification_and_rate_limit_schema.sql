-- Referral production-readiness, part 1 of 2: schema.
--
-- Adds the state email verification needs on `waitlist`, the append-only
-- attempt log rate limiting reads, and pg_net (outbound HTTP from Postgres,
-- used to call Resend without introducing an edge function).

create extension if not exists pg_net;

-- Verification state. Every column is nullable-or-defaulted so this is safe to
-- apply to a populated table: existing rows land as unverified with no token.
alter table public.waitlist
  add column if not exists email_verified          boolean not null default false,
  add column if not exists verified_at             timestamptz,
  add column if not exists verification_token      text unique,
  add column if not exists verification_expires_at timestamptz;

comment on column public.waitlist.email_verified is
  'True once the address has been proven by clicking the emailed link. A referral is only ever counted at this transition.';
comment on column public.waitlist.verification_token is
  'Single-use in effect: reuse is blocked by email_verified, not by clearing this, so a double-clicked link reports "already verified" rather than "invalid".';

-- Append-only signup log, read by join_waitlist for per-IP rate limiting.
-- No upsert, no counter bookkeeping: the count is a query over a time window.
create table if not exists public.signup_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip         inet not null,
  created_at timestamptz not null default now()
);

comment on table public.signup_attempts is
  'Rate-limiting log for join_waitlist. Written only when a signup actually creates a row or resends a verification email, never on a duplicate-email no-op.';

create index if not exists signup_attempts_ip_created_at_idx
  on public.signup_attempts (ip, created_at desc);

-- Same posture as public.waitlist: RLS on with zero policies, so the table is
-- unreachable from anon/authenticated. All access is via SECURITY DEFINER RPCs.
alter table public.signup_attempts enable row level security;
revoke all on public.signup_attempts from anon, authenticated;
