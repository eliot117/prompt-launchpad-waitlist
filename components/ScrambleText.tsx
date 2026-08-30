"use client";

import { useEffect, useRef } from "react";

const DUDS = "!<>-_\\/[]{}—=+*^?#";

type Props = {
  text: string;
  color?: string;
  phase?: number;
  period?: number;
};

/**
 * The resting state is always the literal text — a dud glyph must never be
 * what a visitor lands on, and it must never be what prerender emits.
 */
export default function ScrambleText({
  text,
  color = "inherit",
  phase = 0,
  period = 5200,
}: Props) {
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let timer = 0;
    let cancelled = false;

    const settle = () => {
      if (!cancelled) el.textContent = text;
    };

    const scramble = () => {
      if (cancelled) return;
      const queue = Array.from({ length: text.length }, (_, i) => {
        const start = Math.floor(Math.random() * 30);
        return {
          to: text[i],
          start,
          end: start + 10 + Math.floor(Math.random() * 30),
          char: null as string | null,
        };
      });

      let frame = 0;
      const tick = () => {
        if (cancelled) return;
        let out = "";
        let done = 0;
        for (const q of queue) {
          if (frame >= q.end) {
            done++;
            out += q.to;
          } else if (frame >= q.start) {
            if (!q.char || Math.random() < 0.28) {
              q.char = DUDS[Math.floor(Math.random() * DUDS.length)];
            }
            out += `<span style="opacity:0.55">${q.char}</span>`;
          } else {
            out += q.to;
          }
        }
        if (done === queue.length) {
          settle();
          schedule();
          return;
        }
        el.innerHTML = out;
        frame++;
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    // Absolute wall-clock slots, so a slow run never shifts the next cycle.
    const schedule = () => {
      if (cancelled) return;
      const now = Date.now();
      const slot = Math.floor((now - phase) / period) + 1;
      timer = window.setTimeout(scramble, phase + slot * period - now);
    };

    schedule();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      el.textContent = text;
    };
  }, [text, phase, period]);

  return (
    <span ref={elRef} style={{ color }}>
      {text}
    </span>
  );
}
