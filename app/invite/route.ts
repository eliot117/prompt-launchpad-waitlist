import { NextResponse } from "next/server";

/**
 * Makes the pre-signup placeholder link (lib/referral.ts REFERRAL_PLACEHOLDER,
 * ".../invite") a real, working URL instead of dead text: pasted into a
 * browser, it lands on the home page rather than 404ing.
 *
 * Carries no ?ref=, so it never attributes a referral on its own -- that only
 * happens once a signup has its own code and shares the real per-person link
 * built by lib/referral.ts buildReferralLink().
 */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/", request.url));
}
