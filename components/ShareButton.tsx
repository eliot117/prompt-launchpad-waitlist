"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Text to copy. Falls back to a display-only template string if null. */
  link: string | null;
  /** "pill" = the roadmap card's inline social row. "circle" = the footer's round icon buttons. */
  variant: "pill" | "circle";
  iconSize: number;
};

const CLIPBOARD_ICON = (size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const SHARE_ICON = (size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const CHECK_ICON = (size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/** Copies the referral link and swaps its icon for a checkmark for 1.8s. */
export default function ShareButton({ link, variant, iconSize }: Props) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<number>(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = () => {
    const text = link ?? "elia.ai/invite";
    navigator.clipboard?.writeText(text).catch(() => {});
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  const magnetic = {
    onMouseMove: (e: React.MouseEvent<HTMLButtonElement>) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transition = "transform 0.15s ease-out";
      el.style.transform = `translate(${dx * 0.3}px, ${dy * 0.3}px)`;
    },
    onMouseLeave: () => {
      const el = ref.current;
      if (!el) return;
      el.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
      el.style.transform = "translate(0px, 0px)";
    },
  };

  const iconStyle = { position: "absolute" as const, top: 0, left: 0, transition: "opacity 0.25s ease" };

  if (variant === "pill") {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className="mag-link"
        {...magnetic}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "8px 14px",
          borderRadius: 999,
          background: "#eaf2fe",
          color: "#1877f2",
          fontSize: 11.5,
          fontWeight: 500,
          border: "none",
          cursor: "pointer",
          transition: "background 0.2s, color 0.2s, transform 0.15s ease-out",
        }}
      >
        Share
        <span style={{ position: "relative", width: iconSize, height: iconSize, display: "inline-block" }}>
          <span style={{ ...iconStyle, opacity: copied ? 0 : 1 }}>{CLIPBOARD_ICON(iconSize, "#1877f2")}</span>
          <span style={{ ...iconStyle, opacity: copied ? 1 : 0 }}>{CHECK_ICON(iconSize, "#1877f2")}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Share"
      style={{
        display: "flex",
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
        color: "#ffffff",
      }}
    >
      <span style={{ position: "relative", width: iconSize, height: iconSize, display: "inline-block" }}>
        <span style={{ ...iconStyle, opacity: copied ? 0 : 1 }}>{SHARE_ICON(iconSize, "#ffffff")}</span>
        <span style={{ ...iconStyle, opacity: copied ? 1 : 0 }}>{CHECK_ICON(iconSize, "#ffffff")}</span>
      </span>
    </button>
  );
}
