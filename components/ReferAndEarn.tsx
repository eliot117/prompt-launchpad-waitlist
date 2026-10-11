"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { referralTextToCopy } from "@/lib/referral";

type Step = {
  bg: string;
  stroke: string;
  strokeWidth?: number;
  path: ReactNode;
  body: ReactNode;
};

const STEPS: Step[] = [
  {
    bg: "#eaf2fe",
    stroke: "#1877f2",
    path: <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />,
    body: <>Share your invite link</>,
  },
  {
    bg: "#fdf0e3",
    stroke: "#e08a2e",
    path: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
        <circle cx="18" cy="9" r="2.5" />
        <path d="M16.5 14c2.7.4 4.5 2.5 4.5 6" />
      </>
    ),
    body: (
      <>
        Your friend gets <b style={{ fontWeight: 600, color: "#141416" }}>1 month free</b> when
        they subscribe
      </>
    ),
  },
  {
    bg: "#e9f7ef",
    stroke: "#2ea86a",
    path: <path d="M2 8l4 3 6-7 6 7 4-3-2 12H4L2 8z" />,
    body: (
      <>
        You receive <b style={{ fontWeight: 600, color: "#141416" }}>1 month free</b> for each
        referral
      </>
    ),
  },
  {
    bg: "#f7e9f5",
    stroke: "#b13fa0",
    strokeWidth: 2.2,
    path: <path d="M12 2l3 7h7l-5.5 5 2 8-6.5-5-6.5 5 2-8L2 9h7z" />,
    body: (
      <>
        Refer <b style={{ fontWeight: 600, color: "#141416" }}>10 friends</b> and get{" "}
        <b style={{ fontWeight: 600, color: "#141416" }}>12 months free</b>
      </>
    ),
  },
];

type Props = { referralLink: string | null };

export default function ReferAndEarn({ referralLink }: Props) {
  const [copied, setCopied] = useState(false);
  const [filled, setFilled] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Falls back to the design's literal string until a signup produces a real
  // code. Built in lib/referral so this row, the roadmap share button and the
  // footer share button can never drift apart on what they copy.
  const display = referralTextToCopy(referralLink);

  const onCopy = () => {
    navigator.clipboard?.writeText(display).catch(() => {});
    timers.current.forEach(clearTimeout);
    setCopied(true);
    setFilled(false);
    setRevealed(false);
    timers.current = [
      window.setTimeout(() => setFilled(true), 300),
      window.setTimeout(() => setRevealed(true), 1900),
      window.setTimeout(() => {
        setCopied(false);
        setFilled(false);
        setRevealed(false);
      }, 4400),
    ];
  };

  return (
    <div
      style={{
        width: "100%",
        background: "#ffffff",
        padding: "80px 4% 140px",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 600,
          background:
            "radial-gradient(circle at center, #ffffff 0%, #e0f4ff 50%, #a6ffff 100%)",
          borderRadius: 24,
          boxShadow:
            "0 2px 4px rgba(16,24,40,0.10), 0 12px 24px rgba(16,24,40,0.16), 0 32px 64px rgba(16,24,40,0.22), 0 60px 100px rgba(16,24,40,0.18)",
          padding: "80px 48px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginTop: -48,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.4,
                color: "#1877f2",
                background: "#eaf2fe",
                padding: "8px 14px",
                borderRadius: 999,
              }}
            >
              Earn 1+ months free
            </div>
            {/* h2, not h3 — this sits alongside the other section headings
                under the page's single h1, and an h3 here skipped a level.
                Every visual property is set explicitly, so the tag swap
                changes nothing on screen. */}
            <h2
              style={{
                margin: "18px 0 0",
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: -0.4,
                color: "#141416",
              }}
            >
              Refer &amp; Earn
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 300, color: "#003a42" }}>
              for each friend that you invite
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 500, color: "#003a42" }}>
              Referral rewards are currently inactive. Signups can record an invite source, but do not earn reward credits.
            </p>
          </div>
          <div
            style={{
              flexShrink: 0,
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "#eaf2fe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 64 64"
              fill="none"
              stroke="#1877f2"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M60 6L4 27l20 8" />
              <path d="M60 6L37 58l-13-23" />
              <path d="M60 6L24 35" />
              <path d="M6 47l9-9" />
              <path d="M13 54l9-9" />
            </svg>
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#141416" }}>How it works:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: s.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={s.stroke}
                    strokeWidth={s.strokeWidth ?? 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {s.path}
                  </svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 300, color: "#5b5f66" }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 74 }}>
          <div
            style={{ fontSize: 13.5, fontWeight: 600, color: "#141416", marginBottom: 10 }}
          >
            Your invite link:
          </div>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "#f0f1f4",
              border: "1px solid #141416",
              borderRadius: 999,
              padding: 4,
              width: "100%",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.3,
                color: "#141416",
                padding: "0 14px",
                height: 36,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                opacity: copied ? 0 : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              {display}
            </div>
            <button
              type="button"
              onClick={onCopy}
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: "#eaf2fe",
                color: "#1877f2",
                border: "1px solid #1877f2",
                borderRadius: 999,
                padding: "0 20px",
                height: 36,
                width: 92,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(16,24,40,0.06)",
                opacity: copied ? 0 : 1,
                transition: "opacity 0.3s ease",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
                aria-hidden="true"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy
            </button>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: `${filled ? 100 : 0}%`,
                background: "#1877f2",
                borderRadius: 999,
                transition: "width 1.6s cubic-bezier(0.65,0,0.35,1)",
                pointerEvents: "none",
              }}
            />
            <div
              aria-live="polite"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: revealed ? 1 : 0,
                transition: "opacity 0.6s ease",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#141416",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#141416" }}>
                {revealed ? "Link Copied!" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
