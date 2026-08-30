import { NextResponse } from "next/server";
import { verifyEmail } from "@/lib/supabase";

/**
 * Deliberately a Route Handler and not a page: the designed /verify screen is
 * being built separately, and nothing here should pre-empt it. This exists so
 * the link in the verification email is functional today rather than 404ing,
 * and so the backend flow is complete and testable end to end.
 *
 * Replacing it later is additive: drop in app/verify/page.tsx and delete this
 * file. The RPC contract it calls does not change.
 */

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { status: number; text: string }> = {
  verified: { status: 200, text: "Email verified. You're on the Prompt Launchpad waitlist." },
  already_verified: { status: 200, text: "This email is already verified. You're on the list." },
  expired: { status: 410, text: "This verification link has expired. Sign up again to get a new one." },
  invalid: { status: 404, text: "This verification link isn't valid." },
};

function plain(text: string, status: number) {
  return new NextResponse(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // A verification result is per-token and single-use; never cache it.
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return plain("Missing verification token.", 400);
  }

  try {
    const result = await verifyEmail(token, new URL(request.url).origin);
    const message = MESSAGES[result.status] ?? MESSAGES.invalid;
    return plain(message.text, message.status);
  } catch {
    // Config or network failure, not a bad token: don't tell someone holding a
    // perfectly good link that it's invalid.
    return plain("Couldn't check that link right now. Try again shortly.", 503);
  }
}
