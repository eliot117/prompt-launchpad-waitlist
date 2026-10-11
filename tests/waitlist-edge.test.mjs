import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler, trustedClientIp } from '../supabase/functions/waitlist/handler.ts';

const origin='https://prompt-launchpad-waitlist.vercel.app';
const token='a'.repeat(64);
function harness(options={}){
  const calls=[];
  const handler=createHandler({
    validateKey:async key=>key==='public-test',
    hashIp:async ip=>{calls.push(['hashIp',ip]);return 'hash-only';},
    rpc:async(name,args)=>{
      calls.push([name,args]);
      if(options.dbFailure)throw new Error('secret database failure');
      if(!['request_waitlist_capture','unsubscribe_waitlist_token'].includes(name))throw new Error('Unexpected legacy/email call');
      return options.result??{status:'accepted'};
    },
  });
  return{calls,request:(body,headers={},method='POST')=>handler(new Request(origin,{
    method,headers:{'content-type':'application/json',apikey:'public-test',origin,'cf-connecting-ip':'203.0.113.1',...headers},
    ...(method==='POST'?{body:JSON.stringify(body)}:{}),
  }))};
}
test('invalid and oversized input fails before database work',async()=>{
  for(const body of [{},[],{action:'join',email:''},{action:'join',email:'a@'},{action:'join',email:'a@-b.com'},{action:'join',email:'a'.repeat(65)+'@example.com'},{action:'unsubscribe',token:'bad'},{action:'join',email:'a@example.com',referral:'a'.repeat(65)}]){
    const h=harness();assert.equal((await h.request(body)).status,400);assert.deepEqual(h.calls,[]);
  }
  const h=harness();assert.equal((await h.request({action:'join',email:'a@example.com',padding:'x'.repeat(4096)})).status,413);assert.deepEqual(h.calls,[]);
});
test('method, API key and exact browser origin remain enforced',async()=>{
  const h=harness();
  assert.equal((await h.request({}, {},'GET')).status,405);
  assert.equal((await h.request({}, {apikey:'wrong'})).status,401);
  const denied=await h.request({}, {origin:'https://attacker.example'});
  assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
  const preflight=await h.request({}, {},'OPTIONS');assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),origin);assert.deepEqual(h.calls,[]);
});
test('direct join normalises email, hashes IP, and calls no mail or verification RPC',async()=>{
  const h=harness();
  const response=await h.request({action:'join',email:' Test@EXAMPLE.com ',referral:'ABCDEFGH'});
  assert.equal(response.status,202);assert.deepEqual(await response.json(),{status:'accepted'});
  assert.deepEqual(h.calls,[['hashIp','203.0.113.1'],['request_waitlist_capture',{p_email:'test@example.com',p_referred_by:'ABCDEFGH',p_ip_hash:'hash-only'}]]);
});
test('public acknowledgements reveal no status, private token, code or delivery fields',async()=>{
  for(const result of [{status:'accepted'},{status:'accepted',already_joined:true,email_verified:true,referral_code:'SECRET',job:{token:'SECRET'}}]){
    const h=harness({result});assert.deepEqual(await(await h.request({action:'join',email:'a@example.com'})).json(),{status:'accepted'});
  }
});
test('rate limit returns actual bounded retry duration',async()=>{
  const h=harness({result:{status:'rate_limited',retry_after:72}});
  const r=await h.request({action:'join',email:'a@example.com'});
  assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'72');
  assert.equal(r.headers.get('access-control-expose-headers'),'Retry-After');
  assert.deepEqual(await r.json(),{error:'rate_limited',retry_after:72});
  for(const retry_after of [undefined,'internal-secret',Infinity]){
    const r=await harness({result:{status:'rate_limited',retry_after}}).request({action:'join',email:'a@example.com'});
    assert.deepEqual(await r.json(),{error:'rate_limited',retry_after:3600});
  }
});
test('database failures cannot become success or leak details',async()=>{
  const h=harness({dbFailure:true});const r=await h.request({action:'join',email:'a@example.com'});
  assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'temporarily_unavailable'});
  const bad=await harness({result:{status:'unknown'}}).request({action:'join',email:'a@example.com'});
  assert.equal(bad.status,503);
});
test('honeypot makes no write; trusted IP absence still fails closed',async()=>{
  const h=harness();const r=await h.request({action:'join',email:'a@example.com',website:'bot'});
  assert.equal(r.status,202);assert.deepEqual(await r.json(),{status:'accepted'});assert.deepEqual(h.calls,[]);
  assert.equal((await h.request({action:'join',email:'a@example.com'},{'cf-connecting-ip':''})).status,503);assert.deepEqual(h.calls,[]);
  assert.equal(trustedClientIp(new Request(origin,{headers:{'x-forwarded-for':'203.0.113.3'}})),null);
});
test('legacy verification is disabled without mutation; opt-out remains functional',async()=>{
  const h=harness();const disabled=await h.request({action:'verify',token});
  assert.equal(disabled.status,410);assert.deepEqual(await disabled.json(),{error:'verification_not_required'});assert.deepEqual(h.calls,[]);
  const opt=harness({result:{status:'unsubscribed'}});
  assert.deepEqual(await(await opt.request({action:'unsubscribe',token})).json(),{status:'unsubscribed'});
  assert.deepEqual(opt.calls,[['unsubscribe_waitlist_token',{p_token:token}]]);
});
