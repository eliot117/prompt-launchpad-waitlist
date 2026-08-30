"use client";

import { useEffect, useRef, useState } from "react";
import { RAW_INPUT, MASTER_PROMPT } from "@/lib/content";

const BLOBS = [
  { hex: "226,226,226", baseX: 67.04, baseY: 45.93, p1: 0.7, p2: 2.1, stops: [0, 19.02, 38.05, 57.07, 76.1] },
  { hex: "27,159,254", baseX: 35.47, baseY: 65.92, p1: 3.4, p2: 5.2, stops: [0, 12.9, 25.8, 38.7, 51.6] },
  { hex: "27,159,254", baseX: 48.33, baseY: 20.11, p1: 1.6, p2: 4.4, stops: [0, 16.75, 33.5, 50.25, 67] },
  { hex: "74,201,255", baseX: 80.81, baseY: 88.03, p1: 5.8, p2: 0.9, stops: [0, 10.28, 20.55, 30.83, 41.1] },
];
const OPAC = [1, 0.844, 0.5, 0.156, 0];
const GRAIN =
  `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>` +
  `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter>` +
  `<rect width='100%' height='100%' filter='url(%23n)' opacity='0.500'/></svg>")`;

export default function BeforeAfter() {
  const [pct, setPct] = useState(50);
  const sectionRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Drifting mesh background.
  useEffect(() => {
    const el = meshRef.current;
    if (!el) return;

    const paint = (t: number) => {
      const ph = t * 1.0;
      const grads = BLOBS.map((b) => {
        const dx = (Math.sin(ph * 0.55 + b.p1) - Math.sin(b.p1)) * 14;
        const dy = (Math.sin(ph * 0.43 + b.p2) - Math.sin(b.p2)) * 14;
        const stops = b.stops
          .map((s, i) => `rgba(${b.hex},${OPAC[i]}) ${s}%`)
          .join(", ");
        return `radial-gradient(circle at ${b.baseX + dx}% ${b.baseY + dy}%, ${stops})`;
      });
      el.style.backgroundImage = `${GRAIN}, ${grads.join(", ")}`;
      el.style.backgroundSize = "120px 120px, auto, auto, auto, auto";
      el.style.backgroundBlendMode = "overlay, normal, normal, normal, normal";
    };

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      paint((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Horizontal reveal drag.
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    let dragging = false;

    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const rect = el.getBoundingClientRect();
      setPct(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
    };
    const down = (e: MouseEvent | TouchEvent) => {
      dragging = true;
      move(e);
    };
    const up = () => {
      dragging = false;
    };

    el.addEventListener("mousedown", down);
    el.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      el.removeEventListener("mousedown", down);
      el.removeEventListener("touchstart", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, []);

  // Floating scrollbar mapped to this section's scroll range.
  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!section || !track || !thumb) return;

    const range = () => {
      const r = section.getBoundingClientRect();
      const top = r.top + window.scrollY;
      return { top, span: Math.max(1, r.height - window.innerHeight) };
    };

    const sync = () => {
      const { top, span } = range();
      const inRange =
        window.scrollY >= top - 40 && window.scrollY <= top + span + 40;
      track.style.opacity = inRange ? "1" : "0";
      track.style.pointerEvents = inRange ? "auto" : "none";
      const progress = Math.max(0, Math.min(1, (window.scrollY - top) / span));
      thumb.style.top = `${progress * (track.offsetHeight - thumb.offsetHeight)}px`;
    };

    let dragging = false;
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const rect = track.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const { top, span } = range();
      window.scrollTo({ top: Math.max(0, top + p * span) });
      sync();
      if (e.cancelable) e.preventDefault();
    };
    const down = (e: MouseEvent | TouchEvent) => {
      dragging = true;
      thumb.style.cursor = "grabbing";
      move(e);
    };
    const up = () => {
      dragging = false;
      thumb.style.cursor = "grab";
    };

    track.addEventListener("mousedown", down);
    track.addEventListener("touchstart", down, { passive: false });
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    sync();
    return () => {
      track.removeEventListener("mousedown", down);
      track.removeEventListener("touchstart", down);
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, []);

  return (
    <div
      id="before-after"
      ref={sectionRef}
      style={{
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        padding: "90px 4%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        ref={meshRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, zIndex: 0, backgroundColor: "#E2E2E2" }}
      />

      <div
        ref={trackRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          zIndex: 100000,
          right: "16%",
          top: 90,
          width: 20,
          height: 677,
          opacity: 0,
          transition: "opacity 0.25s ease",
          pointerEvents: "none",
          borderRadius: 999,
          background: "rgba(255,255,255,0.16)",
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.55)",
          boxShadow:
            "inset 0 1px 3px rgba(255,255,255,0.5), inset 0 -1px 3px rgba(16,24,40,0.06), 0 4px 16px rgba(16,24,40,0.08)",
          cursor: "pointer",
        }}
      >
        <div
          ref={thumbRef}
          style={{
            position: "absolute",
            left: -4,
            top: 0,
            width: 28,
            height: 130,
            borderRadius: 999,
            background:
              "linear-gradient(155deg, rgba(255,255,255,0.85) 0%, rgba(190,220,255,0.55) 45%, rgba(120,180,255,0.35) 70%, rgba(255,255,255,0.75) 100%)",
            border: "1px solid rgba(255,255,255,0.75)",
            boxShadow:
              "0 3px 10px rgba(31,119,255,0.28), inset 0 1px 3px rgba(255,255,255,0.9), inset 0 -3px 6px rgba(70,130,255,0.3)",
            cursor: "grab",
            touchAction: "none",
          }}
        />
      </div>

      <div
        ref={sliderRef}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 900,
          height: 7170,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 18px 60px rgba(16,24,40,0.10)",
          border: "1px solid #eef0f3",
          userSelect: "none",
          cursor: "ew-resize",
          background: "#fafbfc",
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "34px 40px",
            boxSizing: "border-box",
            overflow: "auto",
            background: "#fafbfc",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 1,
              color: "#9aa0aa",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Raw Input
          </div>
          <div style={{ fontSize: 15, fontWeight: 400, color: "#3c3c43", lineHeight: 1.7 }}>
            {RAW_INPUT}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "34px 40px",
            boxSizing: "border-box",
            overflow: "auto",
            background: "#ffffff",
            clipPath: `inset(0 0 0 ${pct}%)`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 1,
              color: "#1877f2",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Elia Master Prompt Output
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 400,
              color: "#3c3c43",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {MASTER_PROMPT}
          </pre>
        </div>

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${pct}%`,
            width: 2,
            background: "#1877f2",
            boxShadow: "0 0 0 4px rgba(24,119,242,0.15)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: `${pct}%`,
            width: 40,
            height: 40,
            marginLeft: -20,
            marginTop: -20,
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 4px 14px rgba(16,24,40,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "ew-resize",
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "5px solid transparent",
                borderBottom: "5px solid transparent",
                borderRight: "6px solid #1877f2",
              }}
            />
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "5px solid transparent",
                borderBottom: "5px solid transparent",
                borderLeft: "6px solid #1877f2",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
