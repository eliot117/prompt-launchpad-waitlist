import { verifyEmail } from "@/lib/supabase";
import { buildReferralLink, PRODUCTION_ORIGIN } from "@/lib/referral";
import { confirmationForm, escapeHtml, postedToken, privatePage, TOKEN_RE } from "@/lib/waitlist-pages";

export const dynamic = "force-dynamic";

// Email scanners follow GET links. Only an explicit form submission verifies.
export function GET(request: Request): Response {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return privatePage("Invalid verification link", "<p>Open the complete link from your verification email.</p>", 400);
  return privatePage("Verify your email", `<p>Confirm to join the Prompt Launchpad waitlist and receive waitlist and launch updates. You can unsubscribe at any time.</p>${confirmationForm("/verify", token, "Verify my email")}`);
}

export async function POST(request: Request): Promise<Response> {
  const token = await postedToken(request);
  if (!token) return privatePage("Invalid verification request", "<p>Open your verification email and use its confirmation button.</p>", 400);
  try {
    const result = await verifyEmail(token);
    if (result.status === "expired") return privatePage("Verification link expired", "<p>Join again on the homepage to request a new verification email.</p>", 410);
    if (result.status === "invalid") return privatePage("Invalid verification link", "<p>This link cannot verify a signup. Join again on the homepage to request a new email.</p>", 404);
    const referralLink = buildReferralLink(PRODUCTION_ORIGIN, typeof result.referral_code === "string" ? result.referral_code : null);
    const unsubscribeToken = typeof result.unsubscribe_token === "string" && TOKEN_RE.test(result.unsubscribe_token) ? result.unsubscribe_token : null;
    const referral = referralLink ? `<p>Your personal invite link: <a href="${escapeHtml(referralLink)}">${escapeHtml(referralLink)}</a></p>` : "";
    const optout = unsubscribeToken ? `<p><a href="/unsubscribe?token=${unsubscribeToken}">Unsubscribe from waitlist emails</a></p>` : "<p>You can unsubscribe using the link in a waitlist email.</p>";
    return privatePage("Email verified", `<p>You're on the Prompt Launchpad waitlist.</p>${referral}${optout}`);
  } catch {
    return privatePage("Verification temporarily unavailable", `<p>We couldn't check your link right now. Please try again shortly.</p>${confirmationForm("/verify", token, "Try verification again")}`, 503);
  }
}
