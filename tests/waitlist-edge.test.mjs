import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler, emailContent, trustedClientIp } from '../supabase/functions/waitlist/handler.ts';

const origin = 'https://prompt-launchpad-waitlist.vercel.app';
const token = 'a'.repeat(64);
const job = { id: 'test-job', to: 'test@example.com', kind: 'verification', token, referral_code: 'ABCDEFGH', unsubscribe_token: 'b'.repeat(64) };
const config = { api_key: 'mock-only', from_email: 'test@example.com', site_url: origin };
function harness(options = {}) {
  const calls = [];
  const deps = {
    validateKey: async key => key === 'public-test',
    hashIp: async ip => { calls.push(['hashIp', ip]); return 'hash-only'; },
    sendEmail: async (...args) => { calls.push(['sendEmail', ...args]); if (options.providerFailure) throw new Error('secret provider failure'); return 'provider-id'; },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (options.dbFailure) throw new Error('secret database failure');
      if (name === 'waitlist_delivery_config') { if (options.configFailure) throw new Error('config failure'); return options.unconfigured ? {} : config; }
      if (name === 'record_waitlist_delivery') return null;
      return options.result ?? { status: 'accepted', job };
    },
  };
  const handler = createHandler(deps);
  return { calls, request: (body, headers = {}, method = 'POST') => handler(new Request(origin, {
    method, headers: { 'content-type': 'application/json', apikey: 'public-test', origin, 'cf-connecting-ip': '203.0.113.1', ...headers },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })) };
}

test('validation rejects bad input before any database work', async () => {
  for (const body of [{}, [], { action: 'join', email: '' }, { action: 'join', email: 'a@' }, { action: 'join', email: 'a'.repeat(65)+'@example.com' }, { action: 'verify', token: '<bad>' }, { action: 'join', email:'a@example.com',referral:'a'.repeat(65) }]) {
    const h = harness();
    assert.equal((await h.request(body)).status, 400);
    assert.deepEqual(h.calls, []);
  }
  const h = harness();
  assert.equal((await h.request({ action: 'join', email: 'a@example.com', padding: 'x'.repeat(4096) })).status, 413);
  assert.deepEqual(h.calls, []);
});

test('method, API key and origin are enforced; preflight has exact allowed origin', async () => {
  const h = harness();
  assert.equal((await h.request({}, {}, 'GET')).status, 405);
  assert.equal((await h.request({}, { apikey: 'wrong' })).status, 401);
  const denied = await h.request({}, { origin: 'https://attacker.example' });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const preflight = await h.request({}, {}, 'OPTIONS');
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(h.calls, []);
});

test('normalised join hashes trusted IP and exposes no private fields', async () => {
  const h = harness();
  const response = await h.request({ action: 'join', email: ' Test@EXAMPLE.com ', referral: 'ABCDEFGH' });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { status: 'accepted', email_delivery: 'pending' });
  assert.deepEqual(h.calls.find(c => c[0] === 'request_waitlist_signup')[1], { p_email: 'test@example.com', p_referred_by: 'ABCDEFGH', p_ip_hash: 'hash-only' });
  assert.equal(h.calls.find(c => c[0] === 'record_waitlist_delivery')[1].p_succeeded, true);
});

test('new and existing addresses get identical public responses', async () => {
  const a = harness(), b = harness({ result: { status: 'accepted', job: null } });
  assert.deepEqual(await (await a.request({ action:'join',email:'a@example.com' })).json(), await (await b.request({ action:'join',email:'a@example.com' })).json());
});

test('provider failure records retry state without leaking errors or claiming delivery', async () => {
  const h = harness({ providerFailure: true });
  assert.deepEqual(await (await h.request({ action:'join',email:'a@example.com' })).json(), { status:'accepted',email_delivery:'pending' });
  assert.equal(h.calls.find(c=>c[0]==='record_waitlist_delivery')[1].p_succeeded,false);
  for (const option of [{ unconfigured: true }, { configFailure: true }]) {
    const h = harness(option);
    assert.deepEqual(await (await h.request({ action:'join',email:'a@example.com' })).json(), { status:'accepted',email_delivery:'unavailable' });
    assert.equal(h.calls.some(c=>c[0]==='sendEmail'),false);
  }
});

test('rate limits and database failures return safe useful responses', async () => {
  const h = harness({ result: { status:'rate_limited' } });
  const response = await h.request({ action:'join',email:'a@example.com' });
  assert.equal(response.status,429);
  assert.equal(response.headers.get('retry-after'),'3600');
  const failed = await harness({dbFailure:true}).request({action:'join',email:'a@example.com'});
  assert.equal(failed.status,503);
  assert.deepEqual(await failed.json(),{error:'temporarily_unavailable'});
});

test('honeypot makes no write and missing trusted IP fails closed', async () => {
  const h = harness();
  assert.equal((await h.request({ action:'join',email:'a@example.com',website:'bot' })).status,202);
  assert.deepEqual(h.calls,[]);
  assert.equal((await h.request({action:'join',email:'a@example.com'},{'cf-connecting-ip':''})).status,503);
  assert.deepEqual(h.calls,[]);
  assert.equal(trustedClientIp(new Request(origin,{headers:{'x-forwarded-for':'203.0.113.3'}})),null);
});

test('opt-out is independent of email config and verification only returns allowlisted fields', async () => {
  const h = harness({result:{status:'unsubscribed'},configFailure:true});
  assert.deepEqual(await (await h.request({action:'unsubscribe',token})).json(),{status:'unsubscribed'});
  assert.deepEqual(h.calls.map(c=>c[0]),['unsubscribe_waitlist_token']);
  const v = harness({result:{status:'verified',referral_code:'ABCDEFGH',unsubscribe_token:'b'.repeat(48),private_field:'secret'}});
  assert.deepEqual(await (await v.request({action:'verify',token})).json(),{status:'verified',referral_code:'ABCDEFGH',unsubscribe_token:'b'.repeat(48),email_delivery:'pending'});
});

test('emails contain canonical verification and opt-out URLs', () => {
  const message = emailContent(config,job);
  assert.ok(message.text.includes(`${origin}/verify?token=${token}`));
  assert.ok(message.text.includes(`${origin}/unsubscribe?token=`));
  assert.throws(()=>emailContent({...config,site_url:'https://attacker.example'},job));
});
