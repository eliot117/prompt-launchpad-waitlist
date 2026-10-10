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
const privacy = await loadRoute("../app/privacy/route.ts");
const token = "a".repeat(64);
const optout = "b".repeat(64);
const site = "https://prompt-launchpad-waitlist.vercel.app";
function formRequest(path, body = `token=${token}`, extraHeaders = {}) {
  return new Request(`${site}${path}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: site, ...extraHeaders }, body });
}

test("GET verification and unsubscribe are scanner-safe with private headers", async (t) => {
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("GET must never mutate"); });
  for (const [route, path] of [[verify, "/verify"], [unsubscribe, "/unsubscribe"]]) {
    const response = route.GET(new Request(`${site}${path}?token=${token}`));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
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
    return Response.json({ status: "accepted", email_delivery: "unavailable", referral_code: "must-not-leak" });
  });
  const result = await api.joinWaitlist("  TEST+1@Example.COM  ", "ref123", "https://untrusted.example", "bot-value");
  assert.deepEqual(result, { status: "accepted", email_delivery: "unavailable" });
  assert.match(api.SIGNUP_DELAYED_MESSAGE, /currently unavailable/);
  assert.equal(network.mock.calls.length, 1);
});

test("verify POST returns canonical referral and optout after gateway confirmation", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, options) => {
    assert.deepEqual(JSON.parse(options.body), { action: "verify", token });
    return Response.json({ status: "verified", referral_code: "abc123", referral_count: 0, unsubscribe_token: optout });
  });
  const response = await verify.POST(formRequest("/verify"));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Email verified/);
  assert.ok(html.includes(`${site}/?ref=abc123`));
  assert.ok(html.includes(`/unsubscribe?token=${optout}`));
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
  for (const route of [verify, unsubscribe]) {
    const requests = [
      formRequest("/verify", "token=invalid"),
      formRequest("/verify", `token=${token}&token=${token}`),
      formRequest("/verify", `token=${token}&padding=${"x".repeat(4096)}`),
      formRequest("/verify", `token=${token}`, { origin: "https://attacker.example" }),
    ];
    for (const request of requests) assert.equal((await route.POST(request)).status, 400);
  }
  assert.equal(network.mock.calls.length, 0);
});

test("gateway failures produce safe retry pages and rate-limit messages", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "database-password-SECRET" }, { status: 500 }));
  for (const [route, path] of [[verify, "/verify"], [unsubscribe, "/unsubscribe"]]) {
    const response = await route.POST(formRequest(path));
    assert.equal(response.status, 503);
    const html = await response.text();
    assert.ok(!html.includes("SECRET"));
    assert.match(html, /method="post"/);
  }
  globalThis.fetch = async () => Response.json({ error: "anything" }, { status: 429 });
  await assert.rejects(api.joinWaitlist("a@example.com", null, null), /rate_limited/);
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
  const response = privacy.GET();
  const html = await response.text();
  assert.match(html, /Supabase/);
  assert.match(html, /Unsubscribing suppresses/);
  assert.match(html, /30 days/);
  assert.match(html, /Google Analytics/);
  assert.doesNotMatch(html, /<script/);
});
