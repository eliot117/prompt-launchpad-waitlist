import MarketingPage from "@/components/MarketingPage";
import { publicPageMetadata } from "@/lib/public-page-metadata";

export const metadata = publicPageMetadata("/about","About Prompt Launchpad | Prompt Launchpad","Prompt Launchpad is a prompt-engineering SaaS being built by Eliot in Melbourne. Learn its purpose, development status and waitlist contact details.");

export default function Page() {
  return <MarketingPage title="About Prompt Launchpad">
    <p style={{ margin: "0 0 18px" }}>{"Prompt Launchpad is a prompt-engineering SaaS being built by Eliot in Melbourne, Australia. Its purpose is to help people turn rough input into precise AI prompts, especially for session starters and deep research requests."}</p>
    <p style={{ margin: "0 0 18px" }}>{"Elia is the name of the prompt-engineering agent in the product specification. The planned workflow separates refining an idea from generating the final Master Prompt. A personal prompt library and a handoff to AI Mastery are also in scope for development."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"Current status"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"Prompt Launchpad is in development. This website is its public waitlist. Features described as planned are not a statement that they are already available. Pricing and a release date are not announced here."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"Contact and waitlist preferences"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"For waitlist questions, privacy requests or manual opt-out, email "}<a href="mailto:eliot.rbn18@gmail.com" style={{ color: "#1877f2", textDecoration: "underline" }}>{"eliot.rbn18@gmail.com"}</a>{". For an opt-out request, use the address you signed up with. Requests are handled manually."}</p>
    <p style={{ margin: "0 0 18px" }}>{"The waitlist currently accepts signup requests without verifying inbox ownership. No automated confirmation or verification email is sent. Joining does not create a paid account, and referral reward credits are inactive."}</p>
    <p style={{ margin: "0 0 18px" }}>{"Read the "}<a href="https://prompt-launchpad-waitlist.vercel.app/privacy" style={{ color: "#1877f2", textDecoration: "underline" }}>{"waitlist privacy information"}</a>{"."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"Follow development"}</h2>
    <p style={{ margin: "0 0 18px" }}><a href="https://x.com/Elia_ai_prompts" style={{ color: "#1877f2", textDecoration: "underline" }}>{"X"}</a>{" · "}<a href="https://www.reddit.com/user/Elia_ai_prompts/" style={{ color: "#1877f2", textDecoration: "underline" }}>{"Reddit"}</a></p>
  </MarketingPage>;
}
