import { unsubscribeEmail } from "@/lib/supabase";
import { confirmationForm, postedToken, privatePage, TOKEN_RE } from "@/lib/waitlist-pages";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return privatePage("Invalid unsubscribe link", "<p>Open the complete unsubscribe link from a Prompt Launchpad email.</p>", 400);
  return privatePage("Unsubscribe from waitlist emails", `<p>Confirm to stop Prompt Launchpad waitlist and launch emails for this signup.</p>${confirmationForm("/unsubscribe", token, "Unsubscribe")}`);
}

export async function POST(request: Request): Promise<Response> {
  const token = await postedToken(request);
  if (!token) return privatePage("Invalid unsubscribe request", "<p>Open the unsubscribe link in your email and confirm.</p>", 400);
  try {
    const result = await unsubscribeEmail(token);
    if (result.status === "invalid" || result.status === "expired") return privatePage("Unsubscribe link unavailable", "<p>This link is invalid or expired. Use the unsubscribe link in your latest Prompt Launchpad email.</p>", 400);
    return privatePage("Unsubscribed", "<p>You won't receive further Prompt Launchpad waitlist or launch emails for this signup.</p>");
  } catch {
    return privatePage("Unsubscribe temporarily unavailable", `<p>We couldn't update your preference right now. Please try again shortly.</p>${confirmationForm("/unsubscribe", token, "Try unsubscribe again")}`, 503);
  }
}
