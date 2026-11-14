import type { ReactNode } from "react";

/** Simple server-rendered editorial pages using the existing type and palette. */
export default function MarketingPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#4ac9ff" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px clamp(20px, 5vw, 48px) 64px", color: "#141416" }}>
        <header style={{ marginBottom: 40 }}>
          <a href="/" style={{ fontWeight: 600, color: "#141416" }}>Home</a>
          <nav aria-label="Page navigation" style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", marginTop: 20, fontSize: 14 }}>
            <a href="/how-it-works">How it works</a>
            <a href="/about">About</a>
            <a href="/privacy">Privacy</a>
          </nav>
        </header>
        <main style={{ fontSize: 16, lineHeight: 1.85, color: "#5b5f66", overflowWrap: "anywhere" }}>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", lineHeight: 1.22, fontWeight: 500, color: "#141416", margin: "0 0 24px", letterSpacing: -1 }}>{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
