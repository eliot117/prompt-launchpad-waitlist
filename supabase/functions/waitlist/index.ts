import { createHandler } from "./handler.ts";

const baseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const approvedKeys = new Map<string, number>();

const handler = createHandler({
  async rpc(name, args = {}) {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(args), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const safe = ["invalid_email", "invalid_referral", "invalid_token"].find(value => body.message === value);
      throw new Error(safe ?? "database_unavailable");
    }
    return response.json();
  },
  async validateKey(key) {
    if ((approvedKeys.get(key) ?? 0) > Date.now()) return true;
    const response = await fetch(`${baseUrl}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    if (approvedKeys.size > 16) approvedKeys.clear();
    approvedKeys.set(key, Date.now() + 60000);
    return true;
  },
  async hashIp(ip) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(serviceKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
    return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("");
  },
});

Deno.serve(handler);
