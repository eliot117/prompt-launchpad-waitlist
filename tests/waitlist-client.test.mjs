import assert from "node:assert/strict";
import { test } from "node:test";
import { emailValidationError, messageForError, normaliseEmail, SIGNUP_ACCEPTED_MESSAGE } from "../lib/supabase.ts";
import { buildReferralLink, PRODUCTION_ORIGIN, REFERRAL_PLACEHOLDER, referralTextToCopy } from "../lib/referral.ts";

test("email validation normalises case and surrounding whitespace", () => {
  assert.equal(normaliseEmail("  Test+Waitlist@Example.COM \t"), "test+waitlist@example.com");
  assert.equal(emailValidationError("  Test+Waitlist@Example.COM \t"), null);
});

test("empty and malformed emails have an explicit validation message", () => {
  for (const email of ["", " ", "\t\n"]) {
    assert.equal(emailValidationError(email), "Enter your email address.");
  }
  for (const email of ["invalid", "a@@example.com", "a@example", "@example.com", "a b@example.com", "a@ex ample.com", "a@-b.com", "a@b-.com", "a@b..com", "élise@example.com", "a@例え.com"]) {
    assert.ok(emailValidationError(email), email);
  }
});

test("email boundaries reject oversized local parts and total length", () => {
  assert.equal(emailValidationError(`${"a".repeat(64)}@example.com`), null);
  assert.ok(emailValidationError(`${"a".repeat(65)}@example.com`));
  const domain = `${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  const maxEmail = `${"a".repeat(64)}@${domain}`;
  assert.equal(maxEmail.length, 254);
  assert.equal(emailValidationError(maxEmail), null);
  assert.ok(emailValidationError(`${maxEmail}e`));
});

test("error messages are actionable and never echo internal errors", () => {
  assert.match(messageForError({ message: "rate_limited" }), /Please wait a little/);
  assert.match(messageForError({ message: "rate_limited", retryAfter: 61 }), /2 minutes/);
  assert.match(messageForError({ message: "rate_limited", retryAfter: 1 }), /1 minute/);
  assert.match(messageForError({ message: "rate_limited", retryAfter: Number.MAX_VALUE }), /1440 minutes/);
  for (const retryAfter of [0, -1, Infinity, "SECRET", null]) {
    assert.match(messageForError({ message: "rate_limited", retryAfter }), /Please wait a little/);
  }
  assert.match(messageForError({ message: "invalid_email" }), /email address/);
  assert.match(messageForError({ message: "invalid_referral" }), /invite link/);
  for (const message of ["Failed to fetch", "NetworkError", "fetch failed", "request timed out", "Timeout"]) {
    assert.match(messageForError(new Error(message)), /Can't reach/);
  }
  for (const error of [new Error("database password SECRET in relation private_table"), undefined, { message: "23505 private constraint" }]) {
    assert.equal(messageForError(error), "Something went wrong. Try that again in a moment.");
  }
  assert.equal(SIGNUP_ACCEPTED_MESSAGE, "Thanks! Your signup request has been received.");
});

test("personal referral links cannot inherit preview or attacker origins", () => {
  const expected = `${PRODUCTION_ORIGIN}/?ref=abc_123-xyz`;
  for (const origin of ["https://attacker.example", "http://localhost:3000", "", PRODUCTION_ORIGIN]) {
    assert.equal(buildReferralLink(origin, "abc_123-xyz"), expected);
  }
  for (const code of [null, "", "bad&other=value", "a".repeat(129)]) {
    assert.equal(buildReferralLink(PRODUCTION_ORIGIN, code), null);
  }
  assert.equal(referralTextToCopy(null), REFERRAL_PLACEHOLDER);
  assert.equal(referralTextToCopy(expected), expected);
});
