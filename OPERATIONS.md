# Waitlist operations

## Flow
The form sends bounded, normalized input to the Supabase `waitlist` Edge Function. That function validates the project API key, restricts browser origins, uses the hosted ingress IP for an HMAC rate-limit identity, and calls service-only database functions. Visitors cannot access the underlying tables or legacy signup/status functions.

The database serializes requests by IP identity and canonical email. It records consent, creates a private delivery job, and returns a generic acknowledgement. Verification requires an email token and an explicit POST confirmation; opening the link does not verify an email. A verified referred signup creates one referral event and increments the counter once. Opt-out marks the row and suppresses pending jobs; it does not delete it.

## Configuration
Vercel needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key). They are public configuration. Never put a service-role key in client variables. Preview/development should use an isolated Supabase project; do not submit test signups against production without approval.

The Edge Function uses Supabase's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Its custom authentication checks incoming API keys against this project's Auth settings; JWT verification is disabled to support modern publishable keys.

Email requires Vault secrets named `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `SITE_URL`. Configure them privately in Supabase; do not paste values into source, issues, logs, or chat. The sender must be authorised by Resend. `SITE_URL` must be `https://prompt-launchpad-waitlist.vercel.app`; changing domain requires updating the matching client and Edge Function origin allowlists and redeploying.

## Delivery and recovery
Provider acceptance is recorded as `provider_accepted_at`; it does not prove inbox delivery. No email delivery worker is scheduled. Failed delivery is retried when the same address submits again after five minutes, with at most three attempts per job. Retries reuse the job ID as the Resend idempotency key. After the 24-hour verification expiry, another signup request can create a fresh job. Successful or recently attempted jobs are not resent. Opted-out addresses stay suppressed.

Configuring email later does not automatically send the backlog. Before replaying existing jobs, review the intended recipients and consent, obtain any required sending approval, retain provider idempotency keys, and verify the provider result. Do not mark failed jobs as sent or manually award referral counts to simulate email verification.

## Checks and release
Use Node 24 or newer. Run `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, and `npx deno@2.9.6 check supabase/functions/waitlist/index.ts`. Database tests use PGlite and a captured live-schema fixture; they do not prove multi-session concurrency or deployed behavior.

Apply `20261010212538_waitlist_hardening.sql and then 20261010212844_waitlist_verified_count_privacy.sql` transactionally to the inspected existing schema, deploy the Edge Function files, then deploy the corresponding frontend. The migration aborts on incompatible data instead of merging or deleting rows. Check live grants/RLS, safe API failures, deployment commit, and separately approved real signup outcomes.

The pre-hardening frontend depends on now-revoked RPCs. Do not roll back to it or restore public grants. If release verification fails, keep restrictive database permissions and ship a forward correction or a maintenance form. Preserve records, tokens and referral history.

## Remaining product decisions
The existing display adds a fixed 2,700 to the database count; this is not a verified subscriber total. Privacy contact, retention period and analytics consent require operator decisions. Email uniqueness does not prove unique people: aliases and multiple inboxes can still earn separate verified referral credits. There is no CAPTCHA or automatic outbox retry worker.
