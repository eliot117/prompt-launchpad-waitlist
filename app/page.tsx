"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import CursorTrail from "@/components/CursorTrail";
import RainingLetters from "@/components/RainingLetters";
import ScrambleText from "@/components/ScrambleText";
import SignupsRoadmap, { BASELINE_SIGNUPS } from "@/components/SignupsRoadmap";
import BeforeAfter from "@/components/BeforeAfter";
import ReferAndEarn from "@/components/ReferAndEarn";
import ShareButton from "@/components/ShareButton";
import { joinWaitlist, waitlistCount } from "@/lib/supabase";
import { buildReferralLink } from "@/lib/referral";

const STORAGE_KEY = "pl_waitlist_signup";
const REF_KEY = "pl_referral_ref";
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Referral attribution used to live only in the URL, so it survived exactly
 * one page load: click a link, wander off, come back from a bookmark, and the
 * referrer silently lost the credit. Stashing it on arrival and falling back
 * to it at submit time closes that. Stored with a timestamp so a link clicked
 * months ago doesn't attribute a signup that has nothing to do with it.
 */
function rememberRef(code: string) {
  try {
    localStorage.setItem(REF_KEY, JSON.stringify({ code, ts: Date.now() }));
  } catch {
    // Storage unavailable (private mode, blocked cookies): the URL still works.
  }
}

function recallRef(): string | null {
  try {
    const saved = localStorage.getItem(REF_KEY);
    if (!saved) return null;
    const { code, ts } = JSON.parse(saved) as { code?: string; ts?: number };
    if (!code || typeof ts !== "number" || Date.now() - ts > REF_TTL_MS) return null;
    return code;
  } catch {
    return null;
  }
}

/** Grouped by hand so server and client agree regardless of the active locale. */
const grouped = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function Home() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  // Starts at the baseline alone so the first paint matches the design exactly;
  // the real rows land on top of it once the count resolves.
  const [realSignups, setRealSignups] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setReferralCode(JSON.parse(saved).referral_code ?? null);
    } catch {
      // Corrupt or unavailable storage: fall back to the pre-signup state.
    }
  }, []);

  // Capture on arrival, not at submit time: by then the ?ref= may be long gone.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) rememberRef(ref);
  }, []);

  const refreshCount = useCallback(async () => {
    const n = await waitlistCount();
    if (n !== null) setRealSignups(n);
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  const totalSignups = BASELINE_SIGNUPS + realSignups;

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  // Single source of truth (lib/referral): the roadmap share button, the footer
  // share button and the Refer & Earn row all copy this exact string.
  const referralLink = buildReferralLink(origin, referralCode);

  const fireConfetti = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    const origin = rect
      ? {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        }
      : { x: 0.5, y: 0.6 };
    const colors = ["#ffffff", "#cfe0fb", "#8fc0ff", "#1877f2", "#eaf1fd"];
    confetti({ particleCount: 90, spread: 100, startVelocity: 45, gravity: 0.9, ticks: 220, origin, colors, zIndex: 9999 });
    confetti({ particleCount: 50, spread: 130, startVelocity: 55, gravity: 0.9, ticks: 220, origin, colors, zIndex: 9999, scalar: 0.8, angle: 90 });
  }, []);

  const onSubmit = useCallback(async () => {
    if (!EMAIL_RE.test(email)) {
      setTouched(true);
      return;
    }
    setPending(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref") ?? recallRef();
      const result = await joinWaitlist(email, ref, window.location.origin);
      setReferralCode(result.referral_code);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      } catch {
        // Storage is a convenience here; the signup already succeeded.
      }
      fireConfetti();
      setSubmitted(true);
      setEmail("");
      void refreshCount();
      setTimeout(() => setSubmitted(false), 2600);
    } catch {
      // The design has no error surface; leaving the label unchanged is the
      // only honest signal available without inventing UI.
      setTouched(true);
    } finally {
      setPending(false);
    }
  }, [email, fireConfetti, refreshCount]);

  const showError = touched && email.length > 0 && !EMAIL_RE.test(email);

  return (
    <>
      <CursorTrail />
      <div style={{ background: "#ffffff" }}>
        <div style={{ width: "100%", margin: "0 auto", background: "#ffffff", overflow: "hidden", zoom: 1.1 }}>
          <div style={{ position: "relative", overflow: "hidden", background: "#eef6fd", padding: 0 }}>
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <RainingLetters backgroundColor="#eef6fd" dimColor="148, 178, 214" activeColor="24, 119, 242" />
            </div>
            {[
              "radial-gradient(100% 280px at 50% 0%, rgba(24,119,242,0.34) 0%, rgba(24,119,242,0.16) 45%, rgba(24,119,242,0) 80%)",
              "radial-gradient(100% 280px at 0% 0%, rgba(24,119,242,0.34) 0%, rgba(24,119,242,0.16) 45%, rgba(24,119,242,0) 80%)",
              "radial-gradient(100% 280px at 100% 0%, rgba(24,119,242,0.34) 0%, rgba(24,119,242,0.16) 45%, rgba(24,119,242,0) 80%)",
              "radial-gradient(650px 260px at 50% 100%, rgba(24,119,242,0.55) 0%, rgba(24,119,242,0.25) 55%, rgba(24,119,242,0) 100%)",
              "linear-gradient(180deg,rgba(238,246,253,0) 0%,rgba(255,255,255,0.1) 45%,rgba(255,255,255,0.72) 82%,#ffffff 100%)",
            ].map((bg, i) => (
              <div key={i} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: bg }} />
            ))}

            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "22px 4%" }}>
              <div style={{ position: "absolute", left: "4%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Image src="/assets/prompt-launchpad-logo.png" alt="Prompt Launchpad" width={48} height={48} style={{ objectFit: "contain", display: "block", flexShrink: 0, margin: "-14px 0" }} />
                  <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: -0.2, whiteSpace: "nowrap", lineHeight: 1 }}>
                    <span style={{ color: "#1b1b1f" }}>Prompt</span> <span style={{ color: "#1877f2" }}>Launchpad</span>
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 0, fontSize: 12, fontWeight: 500, color: "#3c3c43", whiteSpace: "nowrap" }}>
                <a href="#features" style={{ color: "#3c3c43", textDecoration: "none", transition: "color 0.2s", flex: 1, textAlign: "right", paddingRight: 80 }}>Features</a>
                <a href="#early" style={{ color: "#3c3c43", textDecoration: "none", transition: "color 0.2s", padding: "0 80px" }}>Join Waiting List</a>
                <a href="#before-after" style={{ color: "#3c3c43", textDecoration: "none", transition: "color 0.2s", flex: 1, textAlign: "left", paddingLeft: 80 }}>Before/After</a>
              </div>
              <div style={{ position: "absolute", right: "4%", display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
                <a href="#early" className="shiny-btn" style={{ fontSize: 11, fontWeight: 500, padding: "8px 15px", borderRadius: 7, backgroundColor: "#1877f2", color: "#ffffff", border: "none", transition: "background-position 0.3s" }}>
                  Get Early Access
                </a>
              </div>
            </div>

            <div style={{ position: "relative", textAlign: "center", padding: "52px 0 0" }}>
              <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.22, fontWeight: 500, letterSpacing: -1, color: "#141416" }}>
                Revolutionizing How You Write Prompts
                <br />
                with <ScrambleText text="Master Prompts" color="#1877f2" phase={0} period={5200} /> using{" "}
                <ScrambleText text="Elia" color="#141416" phase={2000} period={5200} />
              </h1>
              <p style={{ position: "relative", margin: "22px auto 0", fontSize: 14, lineHeight: 1.85, fontWeight: 500, color: "#5b5f66", padding: "26px 60px", maxWidth: 520, boxSizing: "border-box", background: "radial-gradient(closest-side, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.9) 45%, rgba(255,255,255,0) 100%)" }}>
                Prompt Launchpad is an AI-powered solution designed to refine your raw input, structure your prompts, and generate production-ready Master Prompts for any AI model.
              </p>
              <a href="#early" className="shiny-btn" style={{ display: "inline-block", marginTop: 26, backgroundColor: "#1877f2", color: "#ffffff", fontSize: 16, fontWeight: 500, padding: "17px 32px", borderRadius: 10, whiteSpace: "nowrap", border: "none", transition: "background-position 0.3s" }}>
                Get Early Access
              </a>
            </div>

            <div style={{ position: "relative", marginTop: 34, height: 200 }} />

            <SignupsRoadmap totalSignups={totalSignups} referralLink={referralLink} />
          </div>

          <BeforeAfter />
          <ReferAndEarn referralLink={referralLink} />
        </div>

        <div
          id="early"
          style={{
            width: "100%",
            position: "relative",
            zoom: 1.1,
            backgroundColor: "#1877f2",
            backgroundImage:
              "radial-gradient(65% 85% at 50% 40%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0) 78%), repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 26px), repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 26px), linear-gradient(115deg,#0f63d6 0%,#1877f2 50%,#0c58c2 100%)",
            textAlign: "center",
            padding: "150px 4% 20px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 33, lineHeight: 1.28, fontWeight: 500, letterSpacing: -0.8, color: "#ffffff" }}>
            Revolutionizing Prompt
            <br />
            Engineering with AI
          </h2>
          <p style={{ margin: "18px 0 0", fontSize: 10, fontWeight: 300, color: "#e2eeff" }}>
            Join to experience the seamless power of AI-perfected prompts.
          </p>

          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", gap: 10, margin: "26px auto 0", width: "fit-content" }}>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setTouched(true);
                setSubmitted(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSubmit();
              }}
              placeholder="Enter your email"
              aria-label="Email address"
              style={{
                width: 220,
                height: 20,
                boxSizing: "content-box",
                padding: "11px 16px",
                borderRadius: 8,
                border: `1px solid ${showError ? "#ff8a8a" : "rgba(255,255,255,0.4)"}`,
                background: "rgba(255,255,255,0.12)",
                color: "#ffffff",
                fontSize: 11,
                fontWeight: 300,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              ref={btnRef}
              onClick={() => void onSubmit()}
              disabled={pending}
              className="shiny-btn"
              style={{
                backgroundColor: "#ffffff",
                color: "#141416",
                fontSize: 12,
                fontWeight: 500,
                padding: "16px 26px",
                borderRadius: 8,
                border: "none",
                transition: "background-position 0.3s",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}
            >
              {submitted ? "You're in! ✓" : "Get Early Access"}
            </button>
          </div>

          <div style={{ marginTop: 20, fontSize: 15, fontWeight: 400, color: "#cfe0fb", zoom: 0.9091 }}>
            Join {grouped(totalSignups)}+ on the waitlist
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 26 }}>
            {[
              { label: "X", src: "https://cdn.simpleicons.org/x/ffffff", size: 20 },
              { label: "GitHub", src: "https://cdn.simpleicons.org/github/ffffff", size: 22 },
              { label: "Reddit", src: "https://cdn.simpleicons.org/reddit/ff4500", size: 24 },
            ].map((s) => (
              <a key={s.label} href="#" aria-label={s.label} style={{ display: "flex", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.label} width={s.size} height={s.size} />
              </a>
            ))}
            <ShareButton link={referralLink} variant="circle" iconSize={20} />
          </div>

          <div style={{ marginTop: "auto", paddingTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
              <Image src="/assets/prompt-launchpad-logo.png" alt="Prompt Launchpad" width={48} height={48} style={{ objectFit: "contain", display: "block", flexShrink: 0 }} />
              <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: -0.2, whiteSpace: "nowrap", lineHeight: 1, color: "#ffffff" }}>
                Prompt Launchpad
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
