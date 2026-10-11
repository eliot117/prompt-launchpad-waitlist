import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Built on first use, not at module load. `createClient` throws when the env
 * vars are absent, which during prerender fails the whole build rather than
 * the one call that needed it — an environment without credentials (a preview
 * deploy, a fresh clone) should still render the page and only fail on submit.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("fetch failed: Supabase environment variables are not set");
  }
  client ??= createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export type Signup = {
  referral_code: string;
  referral_count: number;
};

export type JoinResult = {
  status: "accepted";
};

export const SIGNUP_ACCEPTED_MESSAGE = "Thanks! Your signup request has been received.";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailValidationError(email: string): string | null {
  const value = normaliseEmail(email);
  if (!value) return "Enter your email address.";
  const parts = value.split("@");
  if (
    value.length > 254 ||
    parts[0].length > 64 ||
    !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)
  ) {
    return "Enter a valid email address (up to 254 characters).";
  }
  return null;
}

export type UnsubscribeResult = { status: "unsubscribed" | "already_unsubscribed" | "expired" | "invalid" };

const SAFE_GATEWAY_ERRORS = new Set(["invalid_email", "invalid_referral", "rate_limited"]);

function safeRetryAfter(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value))) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : null;
}

async function gateway(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!url || !anonKey) throw new Error("fetch failed");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = typeof data?.error === "string" ? data.error : "";
      if (response.status === 429) {
        const retryAfter = safeRetryAfter(data?.retry_after) ?? safeRetryAfter(response.headers.get("Retry-After"));
        throw Object.assign(new Error("rate_limited"), { retryAfter });
      }
      throw new Error(SAFE_GATEWAY_ERRORS.has(error) ? error : "gateway_unavailable");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("gateway_unavailable");
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("request timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function messageForError(err: unknown): string {
  const raw = (
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err ?? "")
  ).toLowerCase();

  if (raw.includes("invalid_email")) {
    return "That doesn't look like an email address.";
  }
  if (raw.includes("rate_limited")) {
    const retryAfter = typeof err === "object" && err !== null && "retryAfter" in err ? safeRetryAfter(err.retryAfter) : null;
    if (retryAfter === null) return "Too many signup attempts. Please wait a little before trying again.";
    const minutes = Math.ceil(retryAfter / 60);
    return `Too many signup attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
  }
  if (raw.includes("invalid_referral")) {
    return "That invite link is no longer valid. Open the homepage without the invite link and try again.";
  }
  if (
    raw.includes("failed to fetch") ||
    raw.includes("networkerror") ||
    raw.includes("fetch failed") ||
    raw.includes("timeout") ||
    raw.includes("timed out")
  ) {
    return "Can't reach the launchpad right now. Try again shortly.";
  }
  return "Something went wrong. Try that again in a moment.";
}

/**
 * Signup responses are acknowledgements, not proof of inbox ownership.
 */
export async function joinWaitlist(
  email: string,
  referredBy: string | null,
  origin: string | null,
  website = "",
): Promise<JoinResult> {
  void origin;
  const canonicalEmail = normaliseEmail(email);
  if (emailValidationError(canonicalEmail)) throw new Error("invalid_email");
  const data = await gateway({ action: "join", email: canonicalEmail, referral: referredBy, website });
  if (data.status !== "accepted") throw new Error("gateway_unavailable");
  return { status: "accepted" };
}

export async function unsubscribeEmail(token: string): Promise<UnsubscribeResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) return { status: "invalid" };
  const data = await gateway({ action: "unsubscribe", token });
  if (!["unsubscribed", "already_unsubscribed", "expired", "invalid"].includes(String(data.status))) throw new Error("gateway_unavailable");
  return data as UnsubscribeResult;
}

export async function waitlistCount(): Promise<number | null> {
  try {
    const { data, error } = await getClient().rpc("waitlist_count");
    if (error) return null;
    return typeof data === "number" ? data : null;
  } catch {
    // Missing config or network failure: the counter falls back to its default.
    return null;
  }
}
