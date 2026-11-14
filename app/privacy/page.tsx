import MarketingPage from "@/components/MarketingPage";
import { publicPageMetadata } from "@/lib/public-page-metadata";

export const metadata = publicPageMetadata(
  "/privacy",
  "Waitlist privacy and email preferences | Prompt Launchpad",
  "Learn how Prompt Launchpad collects, stores, and handles waitlist email addresses, analytics, referral attribution, and opt-out requests.",
);

export default function Page() {
  return (
    <MarketingPage title="Waitlist privacy and email preferences">
      <p style={{ margin: "0 0 18px" }}>
        {"Prompt Launchpad collects your email address to manage its waitlist and send waitlist and launch updates. Joining this list does not create a paid account."}
      </p>
      <p style={{ margin: "0 0 18px" }}>
        {"We store your email, signup time, referral attribution and email preference in Supabase. We also process request information to prevent abuse. The website runs on Vercel."}
      </p>
      <p style={{ margin: "0 0 18px" }}>
        {"Signup requests are accepted directly. Email ownership is not verified, and no automated confirmation or verification email is currently sent. Referral attribution may be recorded, but referral reward credits are currently inactive."}
      </p>
      <p style={{ margin: "0 0 18px" }}>
        {"To opt out of waitlist and launch updates, email "}
        <a href="mailto:eliot.rbn18@gmail.com" style={{ color: "#1877f2", textDecoration: "underline" }}>
          {"eliot.rbn18@gmail.com"}
        </a>
        {" from the address you used to sign up. Requests are handled manually. You can also use a working unsubscribe link from an earlier email. Opting out suppresses future waitlist messages; it does not promise immediate deletion of all signup or security records. Contact the same address for privacy or data-removal requests."}
      </p>
      <p style={{ margin: "0 0 18px" }}>
        {"The landing page loads Google Analytics to measure visits and website usage. Google receives analytics information from your browser and may use cookies or similar identifiers. Opting out of waitlist emails does not disable website analytics. The legacy verification, unsubscribe and privacy pages do not load analytics scripts."}
      </p>
      <p style={{ margin: "0 0 18px" }}>
        {"If you arrive through an invite link, your browser may store its referral code for up to 30 days so a later signup can record its source. Clearing your browser's local storage removes this saved attribution."}
      </p>
    </MarketingPage>
  );
}
