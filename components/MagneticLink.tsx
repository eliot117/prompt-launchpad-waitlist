"use client";

import { useRef, type ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
};

const ARROW = (
  <svg width="11" height="11" viewBox="0 0 15 15" fill="none" aria-hidden="true">
    <path
      d="M3.64645 11.3536C3.45118 11.1583 3.45118 10.8417 3.64645 10.6465L10.2929 4L6 4C5.72386 4 5.5 3.77614 5.5 3.5C5.5 3.22386 5.72386 3 6 3L11.5 3C11.6326 3 11.7598 3.05268 11.8536 3.14645C11.9473 3.24022 12 3.36739 12 3.5L12 9.00001C12 9.27615 11.7761 9.50001 11.5 9.50001C11.2239 9.50001 11 9.27615 11 9.00001V4.70711L4.35355 11.3536C4.15829 11.5488 3.84171 11.5488 3.64645 11.3536Z"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
    />
  </svg>
);

export default function MagneticLink({ href, children }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = "transform 0.15s ease-out, background 0.2s, color 0.2s";
        el.style.transform = `translate(${dx * 0.3}px, ${dy * 0.3}px)`;
      }}
      onMouseLeave={() => {
        const el = ref.current;
        if (!el) return;
        el.style.transition =
          "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s, color 0.2s";
        el.style.transform = "translate(0px, 0px)";
      }}
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
        textDecoration: "none",
      }}
    >
      {children}
      {ARROW}
    </a>
  );
}
