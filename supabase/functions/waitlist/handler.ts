export type Dependencies = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<any>;
  validateKey: (key: string) => Promise<boolean>;
  hashIp: (ip: string) => Promise<string>;
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
      "Access-Control-Expose-Headers": "Retry-After",
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
      // Direct signup does not claim inbox ownership or award verified credits.
      if (action === "verify") return reply(410, { error: "verification_not_required" });
      if (action === "join" && !validEmail(input.email)) return reply(400, { error: "invalid_email" });
      if (action !== "join" && (typeof input.token !== "string" || !TOKEN.test(input.token))) return reply(400, { error: "invalid_token" });
      if (action === "join" && input.referral != null && (typeof input.referral !== "string" || input.referral.length > 64)) return reply(400, { error: "invalid_referral" });
      if (action === "join" && input.website) return reply(202, { status: "accepted" });

      let result;
      if (action === "join") {
        const ip = trustedClientIp(request);
        if (!ip) return reply(503, { error: "client_ip_unavailable" });
        result = await deps.rpc("request_waitlist_capture", {
          p_email: (input.email as string).trim().toLowerCase(),
          p_referred_by: input.referral || null, p_ip_hash: await deps.hashIp(ip),
        });
      } else {
        result = await deps.rpc("unsubscribe_waitlist_token", { p_token: input.token });
      }
      if (result.status === "rate_limited") {
        const seconds = typeof result.retry_after === "number" && Number.isFinite(result.retry_after)
          ? Math.min(3600, Math.max(1, Math.ceil(result.retry_after))) : 3600;
        headers["Retry-After"] = String(seconds);
        return reply(429, { error: "rate_limited", retry_after: seconds });
      }
      if (action === "unsubscribe") return reply(200, { status: result.status });
      if (result.status !== "accepted") throw new Error("unexpected_database_response");
      // Same response for new, existing and opted-out addresses. No email,
      // private tokens, individual status or reward credit is exposed.
      return reply(202, { status: "accepted" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (["invalid_email", "invalid_referral", "invalid_request", "invalid_token"].includes(message)) return reply(400, { error: message });
      if (message === "body_too_large") return reply(413, { error: "body_too_large" });
      return reply(503, { error: "temporarily_unavailable" });
    }
  };
}
