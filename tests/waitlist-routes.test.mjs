import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-publishable-placeholder";
const api = await import("../lib/supabase.ts");

// Compile only the tested route modules; their real helpers run unchanged.
async function loadRoute(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const resolved = compiled.replace(/from "@\/lib\/([^"\n]+)"/g, (_, file) => `from "${new URL(`../lib/${file}.ts`, import.meta.url).href}"`);
  return import(`data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`);
}
const verify = await loadRoute("../app/verify/route.ts");
const unsubscribe = await loadRoute("../app/unsubscribe/route.ts");
const token = "a".repeat(64);
const site = "https://prompt-launchpad-waitlist.vercel.app";
function formRequest(path, body = `token=${token}`, extraHeaders = {}) {
  return new Request(`${site}${path}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: site, ...extraHeaders }, body });
}

test("GET unsubscribe is scanner-safe with private headers", async (t) => {
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("GET must never mutate"); });
  for (const [route, path] of [[unsubscribe, "/unsubscribe"]]) {
    const response = route.GET(new Request(`${site}${path}?token=${token}`));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("referrer-policy"), "strict-origin");
    assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
    assert.match(await response.text(), new RegExp(`<form method="post" action="${path}"`));
    assert.equal(route.GET(new Request(`${site}${path}?token=%22%3E%3Cscript%3E`)).status, 400);
  }
  assert.equal(network.mock.calls.length, 0);
});

test("join uses gateway, normalises email and forwards honeypot without private fields", async (t) => {
  const network = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://fixture.supabase.co/functions/v1/waitlist");
    assert.equal(options.headers.apikey, "test-publishable-placeholder");
    assert.equal(options.cache, "no-store");
    assert.deepEqual(JSON.parse(options.body), { action: "join", email: "test+1@example.com", referral: "ref123", website: "bot-value" });
    return Response.json({ status: "accepted", referral_code: "must-not-leak", already_joined: true, email_verified: false });
  });
  const result = await api.joinWaitlist("  TEST+1@Example.COM  ", "ref123", "https://untrusted.example", "bot-value");
  assert.deepEqual(result, { status: "accepted" });
  assert.doesNotMatch(api.SIGNUP_ACCEPTED_MESSAGE, /inbox|verification|email arrives/i);
  assert.equal(network.mock.calls.length, 1);
});

test("legacy verification GET and POST never mutate or reveal referral data", async (t) => {
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("verification retired"); });
  for (const response of [verify.GET(new Request(`${site}/verify?token=${token}`)), verify.POST(formRequest("/verify")), verify.GET(new Request(`${site}/verify?token=bad`))]) {
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const html = await response.text();
    assert.match(html, /Email verification is no longer required/);
    assert.doesNotMatch(html, /<form|personal invite|unsubscribe\?token=/);
  }
  assert.equal(network.mock.calls.length, 0);
});

test("unsubscription POST mutates only after explicit valid form", async (t) => {
  const network = t.mock.method(globalThis, "fetch", async (_, options) => {
    assert.deepEqual(JSON.parse(options.body), { action: "unsubscribe", token });
    return Response.json({ status: "unsubscribed" });
  });
  const response = await unsubscribe.POST(formRequest("/unsubscribe"));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /won't receive further/);
  assert.equal(network.mock.calls.length, 1);
});

test("invalid, duplicated, oversized and cross-origin token forms never call gateway", async (t) => {
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("unexpected network"); });
  for (const route of [unsubscribe]) {
    const requests = [
      formRequest("/verify", "token=invalid"),
      formRequest("/verify", `token=${token}&token=${token}`),
      formRequest("/verify", `token=${token}&padding=${"x".repeat(4096)}`),
      formRequest("/verify", `token=${token}`, { origin: "https://attacker.example" }),
      formRequest("/verify", `token=${token}`, { origin: "null" }),
    ];
    for (const request of requests) assert.equal((await route.POST(request)).status, 400);
  }
  assert.equal(network.mock.calls.length, 0);
});

test("gateway failures produce safe retry pages and rate-limit messages", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "database-password-SECRET" }, { status: 500 }));
  for (const [route, path] of [[unsubscribe, "/unsubscribe"]]) {
    const response = await route.POST(formRequest(path));
    assert.equal(response.status, 503);
    const html = await response.text();
    assert.ok(!html.includes("SECRET"));
    assert.match(html, /method="post"/);
  }
  globalThis.fetch = async () => Response.json({ error: "anything" }, { status: 429 });
  await assert.rejects(api.joinWaitlist("a@example.com", null, null), /rate_limited/);
});

test("signup accepts only acknowledgement status without provider state", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ status: "accepted" }, { status: 202 }));
  assert.deepEqual(await api.joinWaitlist("a@example.com", null, null), { status: "accepted" });
  for (const data of [null, {}, { status: "verified" }, { status: "failed", error: "SECRET" }]) {
    globalThis.fetch = async () => Response.json(data);
    await assert.rejects(api.joinWaitlist("a@example.com", null, null), /gateway_unavailable/);
  }
});

test("rate-limit response uses numeric delay with safe header fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "rate_limited", retry_after: 61 }, { status: 429 }));
  await assert.rejects(api.joinWaitlist("a@example.com", null, null), (error) => api.messageForError(error).includes("2 minutes"));
  globalThis.fetch = async () => Response.json({ error: "rate_limited", retry_after: "invalid SECRET" }, { status: 429, headers: { "Retry-After": "120" } });
  await assert.rejects(api.joinWaitlist("a@example.com", null, null), (error) => api.messageForError(error).includes("2 minutes"));
  globalThis.fetch = async () => Response.json({ error: "rate_limited", retry_after: -10 }, { status: 429, headers: { "Retry-After": "arbitrary SECRET" } });
  await assert.rejects(api.joinWaitlist("a@example.com", null, null), (error) => api.messageForError(error) === "Too many signup attempts. Please wait a little before trying again.");
});

test("gateway timeout aborts request and yields safe retry message", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", (_, options) => new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const pending = api.joinWaitlist("a@example.com", null, null);
  t.mock.timers.tick(30_000);
  await assert.rejects(pending, /request timed out/);
});

test("privacy page explains processing and preference without analytics", async () => {
  const source = await readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Supabase/);
  assert.match(source, /Opting out suppresses/);
  assert.match(source, /mailto:eliot\.rbn18@gmail\.com/);
  assert.match(source, /handled manually/);
  assert.match(source, /Email ownership is not verified/);
  assert.match(source, /no automated confirmation or verification email is currently sent/);
  assert.match(source, /30 days/);
  assert.match(source, /Google Analytics/);
  assert.doesNotMatch(source, /<script/);
});
