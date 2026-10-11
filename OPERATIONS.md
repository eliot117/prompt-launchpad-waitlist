# Waitlist operations

## Current mode: direct signup
Eliot chose signup without verification emails on 2026-10-11. The website stays at https://prompt-launchpad-waitlist.vercel.app. There is no automated signup/verification/confirmation email and no email-provider configuration is required for capture. eliot.rbn18@gmail.com is the public contact for manual opt-out/privacy requests; no automated Gmail sender has been configured.

The form sends bounded, normalized input to the Supabase waitlist Edge Function. The function validates the project API key, restricts browser origins, uses the hosted ingress IP for an HMAC rate-limit identity, and calls service-only request_waitlist_capture. Visitors cannot read or write tables directly or call the private/legacy RPCs.

The database serializes by IP and canonical email, enforces three valid requests per IP identity per rolling hour, and records every allowed valid request including duplicates. Duplicate and opted-out addresses get the same generic acknowledgement. Rate-limited responses return the actual safe seconds until the oldest counted request expires. Repeated submission never reactivates an opted-out address.

New rows record joined_at, consent_version=waitlist-direct-v2 and optional source attribution. email_verified remains false: direct capture is not inbox ownership. No verification/unsubscribe tokens, delivery jobs or referral credits/events are created. Qualified referral rewards are paused. Legacy records/credits/opt-outs remain intact. Old /verify GET and POST pages no longer mutate anything; the Edge Function verification action is disabled.

## Managing the list
Use Table Editor, public schema, waitlist. A direct signup has joined_at populated. The active direct list is:

```sql
select id,email,joined_at,referred_by,created_at
from public.waitlist
where joined_at is not null and unsubscribed_at is null
order by joined_at desc;
```

Do not filter direct signups by email_verified=true or set that field merely to show capture success. The public waitlist_count deliberately remains verified-only so comparing its value around a direct signup cannot expose whether another person's email already exists. It therefore does not count direct members. The existing frontend adds a fixed2,700 baseline; that unsupported display remains a separate product issue.

For opt-out, the user emails eliot.rbn18@gmail.com from the signup address. Confirm the request's source before an authorised admin marks that exact row unsubscribed and suppresses any legacy pending jobs. Do not offer a public opt-out-by-email endpoint that lets strangers suppress someone else's row. A legacy private-token /unsubscribe link still requires an explicit POST and works without the provider.

## Configuration and privacy
Vercel needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable key). They are public configuration. Never expose service credentials in client variables. Preview/development currently point at production and should be isolated before casual testing.

The Edge Function uses built-in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Custom authentication checks incoming API keys against this project's Auth settings; JWT verification is disabled to support modern publishable keys. The gateway no longer fetches Vault mail secrets or calls Resend. Existing mail secrets, legacy SQL functions and private job history are retained rather than deleted.

The consent notice describes waitlist/launch updates and manual opt-out. It is not proof of ownership; aliases, fabricated addresses and distributed clients remain residual list-quality risks. Google Analytics is disclosed; retention and analytics choice need operator decisions.

## Checks and release
Use Node24 or newer. Run npm ci, npm test, npm run typecheck, npm run build, npm audit --omit=dev, and npx deno@2.9.6 check supabase/functions/waitlist/index.ts. Tests cover both preserved legacy behavior and the new direct-capture boundary. PGlite tests use one connection; do not claim load-tested multi-client concurrency from them.

The direct-mode migration is 20261011053740_waitlist_direct_capture.sql. Apply after the earlier hardening/count migrations, deploy matching Edge Function files and frontend, then verify actual production form outcomes and joined_at while checking no email jobs, tokens or credits were created. Preserve restrictive grants in any rollback.

Legacy confirmation pages use strict-origin referrer policy, preventing token paths/queries from leaking while keeping browser form Origin usable. The no-write real-browser fixture at tests/waitlist-browser-fixture.mjs exercises the shared form parser; /verify production is now retired, and /unsubscribe remains active.

## Audit test data
Previous test signups are opted out and their jobs suppressed. Test-record approval does not authorise deletion. The adjacent audit report, exact-ID record manifest and cleanup draft track every created row; cleanup remains unexecuted unless Eliot separately approves it. The audit's three request logs consume allowance only until their rolling-hour windows expire. Do not silently delete or backdate logs to bypass the limit.

## Historical email mode
The earlier flow queued private verification/confirmation jobs and used Vault RESEND_API_KEY, RESEND_FROM_EMAIL and SITE_URL. Provider acceptance was never inbox proof. It had request-driven five-minute retries with a three-attempt ceiling and no automatic worker. That sending path is no longer called by the public gateway. Restoring email verification would require a separate product decision, provider/sender setup and inbox tests.
