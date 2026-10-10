import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20261010212538_waitlist_hardening.sql', import.meta.url), 'utf8');
const countPrivacyMigration = await readFile(new URL('../supabase/migrations/20261010212844_waitlist_verified_count_privacy.sql', import.meta.url), 'utf8');
const reference = await readFile(new URL('./live-schema-reference.sql', import.meta.url), 'utf8');
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
async function database({ migrate = true, seed = '' } = {}) {
  const db = new PGlite();
  await db.exec(fixture);
  await db.exec(reference);
  await db.exec(seed);
  if (migrate) await db.exec(`begin; ${migration} ${countPrivacyMigration} commit;`);
  return db;
}
async function rpc(db, name, args = []) {
  return (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args)).rows[0].result;
}
const hash = (digit) => digit.repeat(64);
const signup = (db, email, referral = null, ip = hash('a')) => rpc(db, 'request_waitlist_signup', [email, referral, ip]);

test('public aggregate hides new and duplicate pending signups; verification and opt-out update count', async () => {
  const db = await database();
  const publicCount = async () => {
    await db.exec('set role anon;');
    try { return await rpc(db, 'waitlist_count'); }
    finally { await db.exec('reset role;'); }
  };
  try {
    assert.equal(await publicCount(), 0);
    const first = await signup(db, 'count-privacy@example.invalid');
    assert.equal(await publicCount(), 0, 'new pending signup must not affect aggregate');
    await signup(db, ' COUNT-PRIVACY@example.invalid ');
    assert.equal(await publicCount(), 0, 'duplicate pending signup must not affect aggregate');
    await signup(db, 'other-pending@example.invalid');
    assert.equal(await publicCount(), 0, 'all pending entries remain excluded');
    await rpc(db, 'verify_waitlist_token', [first.job.token]);
    assert.equal(await publicCount(), 1, 'verification adds one subscribed entry');
    await rpc(db, 'verify_waitlist_token', [first.job.token]);
    assert.equal(await publicCount(), 1, 'repeated verification cannot inflate count');
    await signup(db, first.job.to, null, hash('b'));
    assert.equal(await publicCount(), 1, 'duplicate verified signup cannot affect aggregate');
    await rpc(db, 'unsubscribe_waitlist_token', [first.job.unsubscribe_token]);
    assert.equal(await publicCount(), 0, 'opt-out removes verified entry from public count');
    assert.equal((await db.query('select count(*)::int as n from public.waitlist')).rows[0].n, 2, 'opt-out preserves stored rows');
  } finally { await db.close(); }
});

test('normalisation, duplicate suppression, input bounds and atomic request allowance', async () => {
  const db = await database();
  try {
    const first = await signup(db, '  Mixed.Case@example.invalid  ');
    assert.equal(first.status, 'accepted'); assert.equal(first.job.to, 'mixed.case@example.invalid');
    assert.match(first.job.referral_code, /^[A-Z0-9]{8}$/);
    assert.equal((await signup(db, 'mixed.case@example.invalid')).job, null);
    assert.equal((await signup(db, 'third@example.invalid')).status, 'accepted');
    assert.equal((await signup(db, 'fourth@example.invalid')).status, 'rate_limited');
    assert.equal((await db.query('select count(*)::int as n from public.waitlist')).rows[0].n, 2);
    for (const invalid of [null, '', ' ', 'bad', 'a@@b.test', `${'a'.repeat(65)}@b.test`, `a@${'x'.repeat(250)}.test`]) {
      await assert.rejects(signup(db, invalid, null, hash('b')), /invalid_email/);
    }
    await assert.rejects(signup(db, 'good@example.invalid', null, null), /invalid_rate_limit_identity/);
    await assert.rejects(signup(db, 'good@example.invalid', 'x'.repeat(129), hash('b')), /invalid_referral/);
    await db.query('update public.waitlist set email=$1 where email=$2', ['  UPDATED@example.invalid ', first.job.to]);
    assert.equal((await db.query('select email from public.waitlist where id=(select waitlist_id from public.waitlist_delivery_jobs where id=$1)', [first.job.id])).rows[0].email, 'updated@example.invalid');
  } finally { await db.close(); }
});

test('verification credits exactly once, tokens hashed, bad attribution ignored and opt-out permanent', async () => {
  const db = await database();
  try {
    const parent = await signup(db, 'parent@example.invalid');
    const child = await signup(db, 'child@example.invalid', parent.job.referral_code.toLowerCase());
    const unknown = await signup(db, 'unknown@example.invalid', 'NOEXISTS');
    assert.equal((await db.query('select referred_by from public.waitlist where email=$1', [unknown.job.to])).rows[0].referred_by, null);
    assert.equal((await db.query('select referral_count from public.waitlist where email=$1', [parent.job.to])).rows[0].referral_count, 0);
    const verified = await rpc(db, 'verify_waitlist_token', [child.job.token]);
    assert.equal(verified.status, 'verified'); assert.equal(verified.job.kind, 'confirmation');
    assert.equal((await rpc(db, 'verify_waitlist_token', [child.job.token])).status, 'already_verified');
    assert.equal((await db.query('select referral_count from public.waitlist where email=$1', [parent.job.to])).rows[0].referral_count, 1);
    assert.equal((await db.query('select count(*)::int as n from public.waitlist_referral_events')).rows[0].n, 1);
    const stored = (await db.query('select verification_token,verification_token_hash from public.waitlist where email=$1', [child.job.to])).rows[0];
    assert.equal(stored.verification_token, null); assert.notEqual(stored.verification_token_hash, child.job.token);
    assert.equal((await rpc(db, 'unsubscribe_waitlist_token', [child.job.unsubscribe_token])).status, 'unsubscribed');
    assert.equal((await rpc(db, 'unsubscribe_waitlist_token', [child.job.unsubscribe_token])).status, 'unsubscribed');
    assert.equal((await rpc(db, 'verify_waitlist_token', [child.job.token])).status, 'invalid');
    assert.equal((await signup(db, child.job.to, null, hash('b'))).job, null);
    assert.equal((await db.query('select count(*)::int as n from public.waitlist')).rows[0].n, 3);
  } finally { await db.close(); }
});

test('failed jobs reuse tokens and idempotency key, cooldown and three-attempt ceiling', async () => {
  const db = await database();
  try {
    const first = await signup(db, 'retry@example.invalid');
    await rpc(db, 'record_waitlist_delivery', [first.job.id, false, null]);
    assert.equal((await signup(db, first.job.to)).job, null);
    for (const identity of ['b', 'c']) {
      await db.query("update public.waitlist_delivery_jobs set last_attempt_at=now()-interval '6 minutes' where id=$1", [first.job.id]);
      const retry = await signup(db, first.job.to, null, hash(identity));
      assert.equal(retry.job.id, first.job.id); assert.equal(retry.job.token, first.job.token);
      await rpc(db, 'record_waitlist_delivery', [first.job.id, false, null]);
    }
    await db.query("update public.waitlist_delivery_jobs set last_attempt_at=now()-interval '6 minutes' where id=$1", [first.job.id]);
    assert.equal((await signup(db, first.job.to, null, hash('d'))).job, null);
    await rpc(db, 'record_waitlist_delivery', [first.job.id, true, 'test-provider-id']);
    await rpc(db, 'record_waitlist_delivery', [first.job.id, false, null]);
    assert.equal((await db.query('select status from public.waitlist_delivery_jobs where id=$1', [first.job.id])).rows[0].status, 'sent');
    await db.query("update public.waitlist set verification_expires_at=now()-interval '1 minute' where email=$1", [first.job.to]);
    assert.equal((await rpc(db, 'verify_waitlist_token', [first.job.token])).status, 'expired');
    const renewed = await signup(db, first.job.to, null, hash('e'));
    assert.notEqual(renewed.job.token, first.job.token);
    assert.equal(renewed.job.unsubscribe_token, first.job.unsubscribe_token);
    assert.equal((await rpc(db, 'unsubscribe_waitlist_token', [first.job.unsubscribe_token])).status, 'unsubscribed');
  } finally { await db.close(); }
});

test('visitor permissions block tables, old RPCs and secret access; aggregate remains allowed', async () => {
  const db = await database();
  try {
    assert.equal((await db.query("select count(*)::int as n from pg_policies where schemaname='public'")).rows[0].n, 0);
    const privateFunctions = ['request_waitlist_signup(text,text,text)', 'verify_waitlist_token(text)', 'unsubscribe_waitlist_token(text)',
      'record_waitlist_delivery(uuid,boolean,text)', 'waitlist_delivery_config()', 'join_waitlist(text,text,text)',
      'verify_email(text,text)', 'get_waitlist_status(text,text)', 'send_email(text,text,text)'];
    for (const role of ['anon', 'authenticated']) {
      for (const signature of privateFunctions) {
        assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') as allowed', [role, `public.${signature}`])).rows[0].allowed, false, `${role}: ${signature}`);
      }
      for (const table of ['waitlist', 'signup_attempts', 'waitlist_request_log', 'waitlist_delivery_jobs', 'waitlist_referral_events']) {
        for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) assert.equal((await db.query('select has_table_privilege($1,$2,$3) as allowed', [role, `public.${table}`, privilege])).rows[0].allowed, false);
      }
      await db.exec(`set role ${role};`);
      await assert.rejects(db.query('select * from public.waitlist'), /permission denied/);
      assert.equal(await rpc(db, 'waitlist_count'), 0);
      await db.exec('reset role;');
    }
    await assert.rejects(rpc(db, 'waitlist_delivery_config'), /delivery_not_configured/);
  } finally { await db.close(); }
});

test('migration preserves legacy verified users and credits and upgrades legacy token lookup', async () => {
  const db = await database({ seed: `
    insert into public.waitlist(email,referral_code,email_verified,verification_token,verification_expires_at)
    values('legacy@example.invalid','LEGACY01',true,repeat('a',48),now()+interval '1 hour');
    update public.waitlist set referral_count=7;
  ` });
  try {
    assert.equal((await db.query('select referral_count from public.waitlist')).rows[0].referral_count, 7);
    assert.equal((await rpc(db, 'verify_waitlist_token', ['a'.repeat(48)])).status, 'already_verified');
    assert.equal((await db.query('select count(*)::int as n from public.waitlist_referral_events')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('migration aborts rather than merge conflicting canonical emails', async () => {
  const db = await database({ migrate: false });
  try {
    await db.exec(`alter table public.waitlist disable trigger waitlist_before_insert_trg;
      insert into public.waitlist(email,referral_code) values('same@example.invalid','EXAMPLE1'),('SAME@example.invalid','EXAMPLE2');`);
    await assert.rejects(db.exec(`begin; ${migration} commit;`), /canonical_email_conflict/);
    await db.exec('rollback;');
    assert.equal((await db.query('select count(*)::int as n from public.waitlist')).rows[0].n, 2);
  } finally { await db.close(); }
});
