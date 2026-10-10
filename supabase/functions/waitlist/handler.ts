export type DeliveryJob = {
  id: string; to: string; kind: "verification" | "confirmation";
  token: string | null; referral_code: string; unsubscribe_token: string;
};
export type DeliveryConfig = { api_key: string | null; from_email: string | null; site_url: string | null };
export type Dependencies = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<any>;
  validateKey: (key: string) => Promise<boolean>;
  hashIp: (ip: string) => Promise<string>;
  sendEmail: (config: DeliveryConfig, job: DeliveryJob) => Promise<string>;
};

const TOKEN = /^(?:[a-f0-9]{48}|[a-f0-9]{64})$/;
const CANONICAL_ORIGIN = "https://prompt-launchpad-waitlist.vercel.app";
const MAX_BODY = 4096;

export function validEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && email.split("@")[0].length <= 64 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(email);
}

export function trustedClientIp(request: Request): string | null {
  // Hosted Supabase ingress is behind Cloudflare. Do not trust the first
  // X-Forwarded-For entry, which may have been supplied by the caller.
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  if (!ip || ip.length > 45 || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) throw new Error("body_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_request");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error("body_too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new Error("invalid_request"); }
}

export function createHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers: Record<string, string> = {
      "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
    if (origin && origin !== CANONICAL_ORIGIN) return reply(403, { error: "origin_not_allowed" });
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") { headers.Allow = "POST, OPTIONS"; return reply(405, { error: "method_not_allowed" }); }
    try {
      const key = request.headers.get("apikey") ?? "";
      if (!key || key.length > 2048 || !await deps.validateKey(key)) return reply(401, { error: "unauthorized" });
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply(415, { error: "invalid_request" });
      const input = await readBody(request);
      const action = input.action;
      if (!["join", "verify", "unsubscribe"].includes(String(action))) return reply(400, { error: "invalid_request" });
      if (action === "join" && !validEmail(input.email)) return reply(400, { error: "invalid_email" });
      if (action !== "join" && (typeof input.token !== "string" || !TOKEN.test(input.token))) return reply(400, { error: "invalid_token" });
      if (action === "join" && input.referral != null && (typeof input.referral !== "string" || input.referral.length > 64)) return reply(400, { error: "invalid_referral" });
      if (action === "join" && input.website) return reply(202, { status: "accepted", email_delivery: "pending" });

      let result;
      if (action === "join") {
        const ip = trustedClientIp(request);
        if (!ip) return reply(503, { error: "client_ip_unavailable" });
        result = await deps.rpc("request_waitlist_signup", {
          p_email: (input.email as string).trim().toLowerCase(),
          p_referred_by: input.referral || null, p_ip_hash: await deps.hashIp(ip),
        });
      } else if (action === "verify") {
        result = await deps.rpc("verify_waitlist_token", { p_token: input.token });
      } else {
        result = await deps.rpc("unsubscribe_waitlist_token", { p_token: input.token });
      }
      if (result.status === "rate_limited") { headers["Retry-After"] = "3600"; return reply(429, { error: "rate_limited" }); }
      // Opt-out must succeed independently of provider configuration.
      if (action === "unsubscribe") return reply(200, { status: result.status });

      // Keep the row even if the provider is down. Durable jobs make retry
      // possible; never call a queued or accepted email 'delivered'.
      let delivery = "pending";
      const config: DeliveryConfig = await deps.rpc("waitlist_delivery_config").catch(() => ({ api_key: null, from_email: null, site_url: null }));
      const configured = !!config.api_key && !!config.from_email && config.site_url === CANONICAL_ORIGIN;
      if (result.job && configured) {
        try {
          const providerId = await deps.sendEmail(config, result.job);
          await deps.rpc("record_waitlist_delivery", { p_job_id: result.job.id, p_succeeded: true, p_provider_id: providerId });
          delivery = "accepted";
        } catch {
          await deps.rpc("record_waitlist_delivery", { p_job_id: result.job.id, p_succeeded: false, p_provider_id: null }).catch(() => {});
        }
      } else if (result.job) {
        await deps.rpc("record_waitlist_delivery", { p_job_id: result.job.id, p_succeeded: false, p_provider_id: null }).catch(() => {});
      }
      if (action === "join") {
        // Same shape for new, existing and opted-out addresses. A provider
        // configuration outage is global, not an address-existence signal.
        return reply(202, { status: "accepted", email_delivery: configured ? "pending" : "unavailable" });
      }
      return reply(200, {
        status: result.status,
        referral_code: result.referral_code ?? null,
        unsubscribe_token: result.unsubscribe_token ?? null,
        email_delivery: delivery,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (["invalid_email", "invalid_referral", "invalid_request", "invalid_token"].includes(message)) return reply(400, { error: message });
      if (message === "body_too_large") return reply(413, { error: "body_too_large" });
      return reply(503, { error: "temporarily_unavailable" });
    }
  };
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function emailContent(config: DeliveryConfig, job: DeliveryJob) {
  if (config.site_url !== CANONICAL_ORIGIN) throw new Error("email_unavailable");
  const unsubscribe = `${config.site_url}/unsubscribe?token=${encodeURIComponent(job.unsubscribe_token)}`;
  const link = job.kind === "verification"
    ? `${config.site_url}/verify?token=${encodeURIComponent(job.token ?? "")}`
    : `${config.site_url}/?ref=${encodeURIComponent(job.referral_code)}`;
  const subject = job.kind === "verification" ? "Confirm your Prompt Launchpad waitlist request" : "Your Prompt Launchpad referral link";
  const text = job.kind === "verification"
    ? `Confirm your email for the Prompt Launchpad waitlist: ${link}\nThis link expires in 24 hours. If you did not request this, ignore it or opt out below.`
    : `Your email is confirmed. Your personal referral link: ${link}`;
  return { subject, text: `${text}\n\nOpt out: ${unsubscribe}`, html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p><p><a href="${escapeHtml(link)}">${job.kind === "verification" ? "Confirm email" : "Your referral link"}</a></p><p><a href="${escapeHtml(unsubscribe)}">Opt out of the waitlist</a></p>` };
}
