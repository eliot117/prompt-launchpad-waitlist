import { privatePage } from "@/lib/waitlist-pages";

export const dynamic = "force-dynamic";

function retiredVerificationPage(): Response {
  return privatePage("Email verification is no longer required", "<p>Prompt Launchpad now accepts signup requests directly through the homepage. This old verification link does not change your signup or earn referral rewards.</p>");
}

// Both old links and already-open confirmation forms are nonmutating.
export function GET(): Response {
  return retiredVerificationPage();
}

export function POST(): Response {
  return retiredVerificationPage();
}