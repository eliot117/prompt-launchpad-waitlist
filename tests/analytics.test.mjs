import test from 'node:test';
import assert from 'node:assert/strict';
import { trackWaitlistAccepted } from '../lib/analytics.ts';

test('accepted request sends only the fixed, non-identifying payload', () => {
  const calls = [];
  assert.equal(trackWaitlistAccepted((...args) => calls.push(args)), true);
  assert.deepEqual(calls, [['event', 'waitlist_request_accepted', { signup_method: 'direct_capture' }]]);
});

test('blocked analytics cannot break an accepted signup', () => {
  assert.equal(trackWaitlistAccepted(() => { throw new Error('blocked'); }), false);
});

test('server rendering without analytics is safe', () => {
  assert.equal(trackWaitlistAccepted(), false);
});
