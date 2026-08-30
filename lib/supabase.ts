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

export type JoinResult = Signup & {
  already_joined: boolean;
  /** False until they click the link in the verification email. */
  email_verified: boolean;
};

export type VerifyStatus = "verified" | "already_verified" | "expired" | "invalid";

export type VerifyResult = {
  status: VerifyStatus;
  referral_code: string | null;
  referral_count: number | null;
};

export function messageForError(err: unknown): string {
  const raw =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err ?? "");

  if (raw.includes("invalid_email")) {
    return "That doesn't look like an email address.";
  }
  if (raw.includes("rate_limited")) {
    return "Too many signups from this connection. Try again in an hour.";
  }
  if (
    raw.includes("Failed to fetch") ||
    raw.includes("NetworkError") ||
    raw.includes("fetch failed")
  ) {
    return "Can't reach the launchpad right now. Try again shortly.";
  }
  return "Something went wrong. Try that again in a moment.";
}

/**
 * `origin` is where the emailed verification link should point. The server
 * only honours it in a strict `http(s)://host[:port]` shape, and ignores it
 * entirely once a SITE_URL is configured in Vault — a caller must never be
 * able to aim a real verification email at a domain of their choosing.
 */
export async function joinWaitlist(
  email: string,
  referredBy: string | null,
  origin: string | null,
): Promise<JoinResult> {
  const { data, error } = await getClient().rpc("join_waitlist", {
    p_email: email,
    p_referred_by: referredBy,
    p_origin: origin,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("empty response from join_waitlist");
  return row as JoinResult;
}

/** Called from the /verify route handler, not the browser. */
export async function verifyEmail(
  token: string,
  origin: string | null,
): Promise<VerifyResult> {
  const { data, error } = await getClient().rpc("verify_email", {
    p_token: token,
    p_origin: origin,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("empty response from verify_email");
  return row as VerifyResult;
}

/** Requires the referral code as proof of ownership. */
export async function getWaitlistStatus(
  email: string,
  referralCode: string,
): Promise<Signup | null> {
  const { data, error } = await getClient().rpc("get_waitlist_status", {
    p_email: email,
    p_referral_code: referralCode,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return (row as Signup) ?? null;
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
