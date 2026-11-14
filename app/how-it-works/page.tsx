import MarketingPage from "@/components/MarketingPage";
import { publicPageMetadata } from "@/lib/public-page-metadata";

export const metadata = publicPageMetadata("/how-it-works","How Prompt Launchpad is being built | Prompt Launchpad","Explore Prompt Launchpad's planned two-stage prompt workflow, who it is for, and what joining the pre-launch waitlist means.");

export default function Page() {
  return <MarketingPage title="Turn a rough idea into a structured AI prompt">
    <p style={{ margin: "0 0 18px" }}>{"Prompt Launchpad is a prompt-engineering SaaS in development. It is being built for people who want to turn rough ideas into precise instructions for an AI assistant, with particular focus on session starters and deep research requests. The public site currently offers a waitlist for launch updates."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"What is the planned workflow?"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"Elia, the prompt-engineering agent behind Prompt Launchpad, is designed to work in two stages. First, she refines your input into a structured prompt. You then choose when to generate the final Master Prompt. The intended workflow gives you a chance to review the framing before moving to the second stage."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"Who is it being built for?"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"Prompt Launchpad is intended for people who regularly use AI for research, writing, coding, analysis or automation. Its particular focus is the first message that sets up an AI conversation, and research requests that need clear scope, source requirements and output expectations. It is not a promise that any AI model will follow every instruction or produce a correct answer."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"What does a Master Prompt contain?"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"The planned structure covers the AI's role, its task, requirements, useful examples and the requested output format. Elia is designed to adapt that structure to the type of work and chosen AI platform. A Master Prompt is a set of instructions for an AI assistant; it is not the finished research, website or analysis itself."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"Can I use Prompt Launchpad today?"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"The public site is a pre-launch waitlist. Joining records your signup request for waitlist and launch updates; it does not create access to a finished SaaS or a paid account. A release date has not been announced on this page. The examples here illustrate the intended workflow rather than prove that the application is available."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"Will I be able to save and reuse prompts?"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"A per-user prompt library is part of the product specification. Planned features include categories, version history, notes, ratings and reusable templates. These are development plans, not features demonstrated by the waitlist. Public prompt sharing is outside the version-one scope. We will update this page when working features and their limits are confirmed."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"Does it work with different AI assistants?"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"The specification includes adapting prompts to the selected platform and handing them to AI Mastery, a separate app. A companion browser extension is also planned. Those plans do not mean every AI service is integrated today. Compatibility, supported platforms and extension availability need to be confirmed against the released product."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"How much will it cost?"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"Product pricing has not been confirmed on this page. Joining the waitlist does not create a paid account, but that should not be read as a promise that the released software will be free. The development goal of keeping operating API costs at zero is separate from customer pricing."}</p>
    <h2 style={{ margin: "36px 0 12px", color: "#141416", fontSize: 24, lineHeight: 1.35, fontWeight: 500 }}>{"Do referrals earn free months?"}</h2>
    <p style={{ margin: "0 0 18px" }}>{"Referral reward credits are currently inactive. Signup requests can record an invite source, but this does not earn free months or create a redeemable subscription credit. No payment or redemption system is offered through the waitlist. We will only describe a reward programme when its actual terms and operation are confirmed."}</p>
    <p style={{ marginTop: 32 }}><a href="https://prompt-launchpad-waitlist.vercel.app" style={{ color: "#1877f2", fontWeight: 600, textDecoration: "underline" }}>Join the waitlist</a></p>
  </MarketingPage>;
}
