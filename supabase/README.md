# Supabase backend

Everything the browser can reach is a `SECURITY DEFINER` RPC. Both tables have
RLS on with zero policies, so `waitlist` and `signup_attempts` are unreachable
directly with the anon key.

## Migrations

Applied in order, already live on project `vfvbwhmbryjaobwdcxuw`:

| File | What it does |
|---|---|
| `20260830_01_verification_and_rate_limit_schema.sql` | Verification columns on `waitlist`, the `signup_attempts` log, `pg_net` |
| `20260830_02_verified_referrals_and_email.sql` | Rewrites `join_waitlist`, adds `verify_email`, retires the count-on-insert trigger |
| `20260830_03_lock_down_internal_helpers.sql` | Revokes `anon`/`authenticated` EXECUTE on the internal helpers |

## Public RPCs

- `join_waitlist(p_email, p_referred_by, p_origin)` — creates the row, emails a
  verification link. Rate limited to **3 per IP per hour**. Counts nothing.
- `verify_email(p_token, p_origin)` — marks verified and credits the referrer.
  Returns `verified` / `already_verified` / `expired` / `invalid`.
- `get_waitlist_status`, `waitlist_count` — unchanged.

**A referral is counted in exactly one place**: the credit block in
`verify_email`. It deliberately checks nothing about the referrer — not their
own verification state, not any future early-access or account tier. Adding a
condition there would silently break the guarantee that someone earns credit
for people they refer before they themselves have been let in.

## Secrets (Supabase Vault)

Postgres has no environment variables, so these live in Vault under names that
match the env var names. Nothing is hardcoded, and **every email path is a
no-op until these are set** — signup keeps working, the emails just don't send.

Set them once you have a Resend account with a verified sending domain:

```sql
select vault.create_secret('re_your_key_here',            'RESEND_API_KEY');
select vault.create_secret('Prompt Launchpad <hello@yourdomain.com>', 'RESEND_FROM_EMAIL');
```

Optional but recommended once the production domain is settled:

```sql
select vault.create_secret('https://your-live-domain.com', 'SITE_URL');
```

`SITE_URL` overrides the origin the client sends when building emailed links.
Without it the client-supplied origin is accepted, but only in a strict
`http(s)://host[:port]` shape — otherwise a caller could aim a real
verification email at a domain they control.

To update an existing secret, use `vault.update_secret(id, new_value)` rather
than creating a second one with the same name.

## Housekeeping

`signup_attempts` is append-only and never pruned. At waitlist volume this will
not matter; if it ever does, a `pg_cron` job deleting rows older than a day is
enough.
