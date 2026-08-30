"use client";

import { useEffect, useRef } from "react";

const E = { friction: 0.5, trails: 18, size: 44, dampening: 0.25, tension: 0.98 };

type Node = { x: number; y: number; vx: number; vy: number };

/** Spring-chain ribbon that chases the pointer. Fine-pointer devices only. */
export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = { x: 0, y: 0 };
    let running = true;
    let started = false;
    let raf = 0;
    let lines: { spring: number; friction: number; nodes: Node[] }[] = [];

    const makeLine = (spring: number) => ({
      spring: spring + 0.1 * Math.random() - 0.02,
      friction: E.friction + 0.01 * Math.random() - 0.002,
      nodes: Array.from({ length: E.size }, () => ({
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
      })),
    });

    const update = (line: (typeof lines)[number]) => {
      let e = line.spring;
      let t = line.nodes[0];
      t.vx += (pos.x - t.x) * e;
      t.vy += (pos.y - t.y) * e;
      for (let i = 0; i < line.nodes.length; i++) {
        t = line.nodes[i];
        if (i > 0) {
          const n = line.nodes[i - 1];
          t.vx += (n.x - t.x) * e;
          t.vy += (n.y - t.y) * e;
          t.vx += n.vx * E.dampening;
          t.vy += n.vy * E.dampening;
        }
        t.vx *= line.friction;
        t.vy *= line.friction;
        t.x += t.vx;
        t.y += t.vy;
        e *= E.tension;
      }
    };

    const draw = (line: (typeof lines)[number]) => {
      let n = line.nodes[0].x;
      let i = line.nodes[0].y;
      let a = 1;
      ctx.beginPath();
      ctx.moveTo(n, i);
      for (a = 1; a < line.nodes.length - 2; a++) {
        const e = line.nodes[a];
        const t = line.nodes[a + 1];
        n = 0.5 * (e.x + t.x);
        i = 0.5 * (e.y + t.y);
        ctx.quadraticCurveTo(e.x, e.y, n, i);
      }
      const e = line.nodes[a];
      const t = line.nodes[a + 1];
      ctx.quadraticCurveTo(e.x, e.y, t.x, t.y);
      ctx.stroke();
      ctx.closePath();
    };

    const render = () => {
      if (!running) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(24,119,242,0.35)";
      ctx.lineWidth = 1.4;
      for (const line of lines) {
        update(line);
        draw(line);
      }
      raf = requestAnimationFrame(render);
    };

    const resize = () => {
      ctx.canvas.width = window.innerWidth;
      ctx.canvas.height = window.innerHeight;
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e) {
        pos.x = e.touches[0].clientX;
        pos.y = e.touches[0].clientY;
      } else {
        pos.x = e.clientX;
        pos.y = e.clientY;
      }
      if (!started) {
        started = true;
        lines = Array.from({ length: E.trails }, (_, i) =>
          makeLine(0.4 + (i / E.trails) * 0.025),
        );
        render();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        pos.x = e.touches[0].clientX;
        pos.y = e.touches[0].clientY;
      }
    };

    resize();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 99999,
      }}
    />
  );
}
