"use client";

import { useEffect, useRef } from "react";

const LETTER_POOL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(4) +
  "0123456789" +
  "!@#$%^&*()_+-=[]{}|;:,.<>?";

const CHAR_COUNT = 220;

type Props = {
  backgroundColor?: string;
  dimColor?: string;
  activeColor?: string;
};

/**
 * The reference implementation held all 220 glyphs in React state and mapped
 * over them every animation frame, which re-renders the whole field 60x a
 * second. Positions are written straight to the DOM here instead; React only
 * mounts the spans once.
 */
export default function RainingLetters({
  backgroundColor = "#eef6fd",
  dimColor = "148, 178, 214",
  activeColor = "24, 119, 242",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const pick = () => LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];

    const chars = Array.from({ length: CHAR_COUNT }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      speed: 0.08 + Math.random() * 0.22,
      el: document.createElement("span"),
    }));

    for (const c of chars) {
      const s = c.el.style;
      s.position = "absolute";
      s.fontFamily = "monospace";
      s.fontSize = "0.85rem";
      s.fontWeight = "300";
      s.color = `rgba(${dimColor}, 0.55)`;
      s.transition = "color 0.1s, transform 0.1s, font-size 0.1s";
      s.willChange = "transform, top";
      s.left = `${c.x}%`;
      s.top = `${c.y}%`;
      s.transform = "translate(-50%, -50%)";
      c.el.textContent = pick();
      host.appendChild(c.el);
    }

    let raf = 0;
    const step = () => {
      for (const c of chars) {
        if (c.y >= 100) {
          c.y = -5;
          c.x = Math.random() * 100;
          c.el.textContent = pick();
          c.el.style.left = `${c.x}%`;
        } else {
          c.y += c.speed;
        }
        c.el.style.top = `${c.y}%`;
      }
      raf = requestAnimationFrame(step);
    };

    const active = new Set<number>();
    const flickerTick = () => {
      for (const i of active) {
        const s = chars[i].el.style;
        s.fontSize = "0.85rem";
        s.fontWeight = "300";
        s.color = `rgba(${dimColor}, 0.55)`;
        s.textShadow = "none";
        s.transform = "translate(-50%, -50%)";
      }
      active.clear();

      const n = Math.floor(Math.random() * 3) + 3;
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * chars.length);
        active.add(idx);
        const s = chars[idx].el.style;
        s.fontSize = "1.15rem";
        s.fontWeight = "700";
        s.color = `rgb(${activeColor})`;
        s.textShadow = `0 0 10px rgba(${activeColor},0.5)`;
        s.transform = "translate(-50%, -50%) scale(1.2)";
      }
    };

    // The field is decorative and costs a full rAF pass plus a 60ms interval, so
    // it only runs while it is actually on screen. `onScreen` and `tabVisible`
    // are tracked separately because either one alone can stop it, and both must
    // agree before it starts again.
    let flicker = 0;
    let running = false;
    let onScreen = true;
    let tabVisible = !document.hidden;

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(step);
      flicker = window.setInterval(flickerTick, 60);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(flicker);
    };
    const sync = () => (onScreen && tabVisible ? start() : stop());

    // threshold 0 fires the moment any sliver re-enters, so coming back from a
    // scroll, a tab switch, or a window refocus resumes immediately.
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(host);

    const onVisibility = () => {
      tabVisible = !document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    sync();

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      for (const c of chars) c.el.remove();
    };
  }, [dimColor, activeColor]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor,
      }}
    />
  );
}
