import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrations = await Promise.all([
  '20261010212538_waitlist_hardening.sql',
  '20261010212844_waitlist_verified_count_privacy.sql',
  '20261011053740_waitlist_direct_capture.sql',
].map((name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')));
const reference = await readFile(new URL('./live-schema-reference.sql', import.meta.url), 'utf8');
// Matches the restored baseline schema and permissive grants used by the
// original database suite; subsequent migrations must close these grants.
const fixture = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema vault;
create table vault.decrypted_secrets(name text, decrypted_secret text);
create table public.waitlist(
 id uuid primary key default gen_random_uuid(), email text not null unique,
 referral_code text not null unique, referred_by text, referral_count integer not null default 0,
 created_at timestamptz not null default now(), email_verified boolean not null default false,
 verified_at timestamptz, verification_token text unique, verification_expires_at timestamptz,
 constraint waitlist_email_format check(email ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'),
 constraint waitlist_referral_code_format check(referral_code ~ '^[A-Z0-9]{8}$'),
 constraint waitlist_referred_by_format check(referred_by is null or referred_by ~ '^[A-Z0-9]{8}$'),
 constraint waitlist_no_self_referral check(referred_by is null or referred_by<>referral_code),
 constraint waitlist_referral_count_non_negative check(referral_count>=0)
);
create table public.signup_attempts(id uuid primary key default gen_random_uuid(),ip inet not null,created_at timestamptz not null default now());
alter table public.waitlist enable row level security;
alter table public.signup_attempts enable row level security;
grant all on public.waitlist,public.signup_attempts to anon,authenticated;
create policy "Allow public inserts" on public.waitlist for insert to public with check(true);
create policy "Allow public inserts" on public.signup_attempts for insert to public with check(true);
`;
async function database(seed = '') {
  const db = new PGlite();
  await db.exec(fixture);
  await db.exec(reference);
  await db.exec(seed);
  await db.exec(`begin; ${migrations.join('\n')} commit;`);
  return db;
}
async function rpc(db, name, args = []) {
  return (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args)).rows[0].result;
}
const hash = (digit) => digit.repeat(64);
const capture = (db, email, referral = null, ip = hash('a')) => rpc(db, 'request_waitlist_capture', [email, referral, ip]);
const row = async (db, email) => (await db.query('select * from public.waitlist where email=$1', [email])).rows[0];

test('direct capture normalises and deduplicates without verification, email jobs, credits or public count changes', async () => {
  const db = await database();
  try {
    const initialCount = await rpc(db, 'waitlist_count');
    assert.deepEqual(await capture(db, '  Capture.Test@example.invalid  '), { status: 'accepted' });
    const first = await row(db, 'capture.test@example.invalid');
    assert.ok(first.joined_at); assert.ok(first.consent_recorded_at);
    assert.equal(first.consent_version, 'waitlist-direct-v2');
    assert.equal(first.email_verified, false); assert.equal(first.verified_at, null);
    assert.equal(first.verification_token, null); assert.equal(first.verification_token_hash, null);
    assert.equal(first.verification_expires_at, null); assert.equal(first.unsubscribe_token_hash, null);
    assert.equal(first.referral_count, 0);
    assert.deepEqual(await capture(db, 'CAPTURE.TEST@example.invalid'), { status: 'accepted' });
    const repeated = await row(db, first.email);
    assert.equal(repeated.id, first.id); assert.deepEqual(repeated.joined_at, first.joined_at);
    assert.deepEqual(repeated.consent_recorded_at, first.consent_recorded_at);
    assert.equal((await db.query('select count(*)::int as n from public.waitlist')).rows[0].n, 1);
    for (const table of ['waitlist_delivery_jobs', 'waitlist_referral_events']) {
      assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 0);
    }
    assert.equal(await rpc(db, 'waitlist_count'), initialCount);
  } finally { await db.close(); }
});

test('atomic shared quota counts duplicates, reports actual expiry seconds and recovers after window', async () => {
  const db = await database();
  try {
    for (let i = 0; i < 3; i++) assert.deepEqual(await capture(db, 'quota@example.invalid'), { status: 'accepted' });
    const blocked = await capture(db, 'quota@example.invalid');
    assert.equal(blocked.status, 'rate_limited'); assert.ok(blocked.retry_after >= 3590 && blocked.retry_after <= 3600);
    await db.exec("update public.waitlist_request_log set created_at=now()-interval '59 minutes';");
    const nearExpiry = await capture(db, 'quota@example.invalid');
    assert.equal(nearExpiry.status, 'rate_limited'); assert.ok(nearExpiry.retry_after >= 59 && nearExpiry.retry_after <= 60);
    assert.equal((await db.query('select count(*)::int as n from public.waitlist_request_log')).rows[0].n, 3);
    await db.exec("update public.waitlist_request_log set created_at=now()-interval '61 minutes';");
    assert.deepEqual(await capture(db, 'quota@example.invalid'), { status: 'accepted' });
    // A legacy delivery request consumes the same quota namespace/log.
    await rpc(db, 'request_waitlist_signup', ['legacy-quota@example.invalid', null, hash('a')]);
    assert.deepEqual(await capture(db, 'quota@example.invalid'), { status: 'accepted' });
    assert.equal((await capture(db, 'another@example.invalid')).status, 'rate_limited');
  } finally { await db.close(); }
});

test('attribution records only valid referrers without awarding credit or changing duplicate attribution', async () => {
  const db = await database();
  try {
    await capture(db, 'referrer@example.invalid');
    const referrer = await row(db, 'referrer@example.invalid');
    await capture(db, 'referred@example.invalid', ` ${referrer.referral_code.toLowerCase()} `);
    assert.equal((await row(db, 'referred@example.invalid')).referred_by, referrer.referral_code);
    await capture(db, referrer.email, referrer.referral_code);
    assert.equal((await row(db, referrer.email)).referred_by, null, 'self-referral cannot change an existing row');
    assert.equal((await row(db, referrer.email)).referral_count, 0);
    await capture(db, 'invalid-ref@example.invalid', 'NOEXISTS', hash('b'));
    assert.equal((await row(db, 'invalid-ref@example.invalid')).referred_by, null);
    await db.query('update public.waitlist set unsubscribed_at=now() where id=$1', [referrer.id]);
    await capture(db, 'optout-ref@example.invalid', referrer.referral_code, hash('b'));
    assert.equal((await row(db, 'optout-ref@example.invalid')).referred_by, null);
    assert.equal((await db.query('select count(*)::int as n from public.waitlist_referral_events')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('legacy pending capture is recorded accurately; verified state, existing credit and opt-out remain intact', async () => {
  const db = await database(`
    insert into public.waitlist(email,referral_code,email_verified,verified_at)
      values('pending@example.invalid','PENDING1',false,null),('verified@example.invalid','VERIFIED',true,now()),('optout@example.invalid','OPTOUT01',false,null);
    update public.waitlist set referral_count=7 where email='verified@example.invalid';
  `);
  try {
    await db.exec("update public.waitlist set unsubscribed_at=now(),consent_version='legacy-optout' where email='optout@example.invalid';");
    const optedOutBefore = await row(db, 'optout@example.invalid');
    assert.deepEqual(await capture(db, 'pending@example.invalid'), { status: 'accepted' });
    const pending = await row(db, 'pending@example.invalid');
    assert.ok(pending.joined_at); assert.equal(pending.email_verified, false); assert.equal(pending.consent_version, 'waitlist-direct-v2');
    const verifiedBefore = await row(db, 'verified@example.invalid');
    await capture(db, verifiedBefore.email);
    const verified = await row(db, verifiedBefore.email);
    assert.equal(verified.email_verified, true); assert.deepEqual(verified.verified_at, verifiedBefore.verified_at);
    assert.equal(verified.referral_count, 7);
    assert.deepEqual(await capture(db, 'optout@example.invalid'), { status: 'accepted' });
    assert.deepEqual(await row(db, 'optout@example.invalid'), optedOutBefore, 'opt-out row is untouched');
    assert.equal(await rpc(db, 'waitlist_count'), 1);
    assert.equal((await db.query('select count(*)::int as n from public.waitlist_delivery_jobs')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('direct capture validates inputs and is callable only by service role; table privacy remains intact', async () => {
  const db = await database();
  try {
    for (const invalid of [null, '', ' ', 'invalid', 'a@@b.test', 'a@-bad.test', `${'a'.repeat(65)}@b.test`, `a@${'x'.repeat(250)}.test`]) {
      await assert.rejects(capture(db, invalid), /invalid_email/);
    }
    await assert.rejects(capture(db, 'valid@example.invalid', 'x'.repeat(129)), /invalid_referral/);
    await assert.rejects(capture(db, 'valid@example.invalid', null, null), /invalid_rate_limit_identity/);
    assert.equal((await db.query('select count(*)::int as n from public.waitlist_request_log')).rows[0].n, 0);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query("select has_function_privilege($1,'public.request_waitlist_capture(text,text,text)','execute') as allowed", [role])).rows[0].allowed, false);
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query("select has_table_privilege($1,'public.waitlist',$2) as allowed", [role, privilege])).rows[0].allowed, false);
      }
      await db.exec(`set role ${role};`);
      await assert.rejects(capture(db, 'denied@example.invalid'), /permission denied/);
      assert.equal(await rpc(db, 'waitlist_count'), 0);
      await db.exec('reset role;');
    }
    await db.exec('set role service_role;');
    assert.deepEqual(await capture(db, 'allowed@example.invalid'), { status: 'accepted' });
    await db.exec('reset role;');
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.waitlist'::regclass")).rows[0].relrowsecurity, true);
  } finally { await db.close(); }
});
