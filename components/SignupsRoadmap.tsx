"use client";

import Image from "next/image";
import MagneticLink from "@/components/MagneticLink";
import ShareButton from "@/components/ShareButton";

const MILESTONES = [
  { icon: "/uploads/bicycle.png", size: 28, pull: -6, label: "500+", count: 500, delay: 0.2 },
  { icon: "/uploads/sport-car.png", size: 40, pull: -12, label: "2,000+", count: 2000, delay: 0.35 },
  { icon: "/uploads/airplane.png", size: 52, pull: -18, label: "5,000+", count: 5000, delay: 0.5 },
  { icon: "/uploads/rocket.png", size: 40, pull: -12, label: "10,000+", count: 10000, delay: 0.65 },
];

const SPARKS = [
  { left: 0, top: 8, size: 13, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.6, delay: 0.23 },
  { left: 4, top: 2, size: 9, color: "#ffe066", shadow: "0 0 5px rgba(255,224,102,0.85)", dur: 0.55, delay: 0.08 },
  { left: 2, top: 14, size: 8, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.65, delay: 0.11 },
  { left: 8, top: 9, size: 12, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.5, delay: 0.34 },
  { left: 0, top: 16, size: 7, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.7, delay: 0.03 },
  { left: 6, top: 4, size: 10, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.58, delay: 0.31 },
  { left: 2, top: 9, size: 14, color: "#ffd93d", shadow: "0 0 7px rgba(255,217,61,0.9)", dur: 0.62, delay: 0.06 },
  { left: 5, top: 12, size: 8, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.52, delay: 0.28 },
  { left: -4, top: 6, size: 11, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.63, delay: 0.49 },
  { left: -6, top: 11, size: 9, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.57, delay: 0.34 },
  { left: 0, top: 8, size: 13, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.6, delay: 0.03 },
  { left: 4, top: 2, size: 9, color: "#ffe066", shadow: "0 0 5px rgba(255,224,102,0.85)", dur: 0.55, delay: 0.41 },
  { left: 2, top: 14, size: 8, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.65, delay: 0.45 },
  { left: 8, top: 9, size: 12, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.5, delay: 0.34 },
  { left: 0, top: 16, size: 7, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.7, delay: 0.06 },
  { left: 6, top: 4, size: 10, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.58, delay: 0.5 },
  { left: 2, top: 9, size: 14, color: "#ffd93d", shadow: "0 0 7px rgba(255,217,61,0.9)", dur: 0.62, delay: 0.52 },
  { left: 5, top: 12, size: 8, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.52, delay: 0.47 },
  { left: -4, top: 6, size: 11, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.63, delay: 0.1 },
  { left: -6, top: 11, size: 9, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.57, delay: 0.5 },
  { left: 0, top: 8, size: 13, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.6, delay: 0.29 },
  { left: 4, top: 2, size: 9, color: "#ffe066", shadow: "0 0 5px rgba(255,224,102,0.85)", dur: 0.55, delay: 0.13 },
  { left: 2, top: 14, size: 8, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.65, delay: 0.09 },
  { left: 8, top: 9, size: 12, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.5, delay: 0.36 },
  { left: 0, top: 16, size: 7, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.7, delay: 0.15 },
  { left: 6, top: 4, size: 10, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.58, delay: 0.14 },
  { left: 2, top: 9, size: 14, color: "#ffd93d", shadow: "0 0 7px rgba(255,217,61,0.9)", dur: 0.62, delay: 0.58 },
  { left: 5, top: 12, size: 8, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.52, delay: 0.38 },
  { left: -4, top: 6, size: 11, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.63, delay: 0.43 },
  { left: -6, top: 11, size: 9, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.57, delay: 0.32 },
  { left: 0, top: 8, size: 13, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.6, delay: 0.32 },
  { left: 4, top: 2, size: 9, color: "#ffe066", shadow: "0 0 5px rgba(255,224,102,0.85)", dur: 0.55, delay: 0.07 },
  { left: 2, top: 14, size: 8, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.65, delay: 0.07 },
  { left: 8, top: 9, size: 12, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.5, delay: 0.22 },
  { left: 0, top: 16, size: 7, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.7, delay: 0.36 },
  { left: 6, top: 4, size: 10, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.58, delay: 0.23 },
  { left: 2, top: 9, size: 14, color: "#ffd93d", shadow: "0 0 7px rgba(255,217,61,0.9)", dur: 0.62, delay: 0.28 },
  { left: 5, top: 12, size: 8, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.52, delay: 0.53 },
  { left: -4, top: 6, size: 11, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.63, delay: 0.54 },
  { left: -6, top: 11, size: 9, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.57, delay: 0.34 },
  { left: 0, top: 8, size: 13, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.6, delay: 0.25 },
  { left: 4, top: 2, size: 9, color: "#ffe066", shadow: "0 0 5px rgba(255,224,102,0.85)", dur: 0.55, delay: 0.25 },
  { left: 2, top: 14, size: 8, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.65, delay: 0.51 },
  { left: 8, top: 9, size: 12, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.5, delay: 0.28 },
  { left: 0, top: 16, size: 7, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.7, delay: 0.16 },
  { left: 6, top: 4, size: 10, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.58, delay: 0.53 },
  { left: 2, top: 9, size: 14, color: "#ffd93d", shadow: "0 0 7px rgba(255,217,61,0.9)", dur: 0.62, delay: 0.6 },
  { left: 5, top: 12, size: 8, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.52, delay: 0.07 },
  { left: -4, top: 6, size: 11, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.63, delay: 0.18 },
  { left: -6, top: 11, size: 9, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.57, delay: 0.34 },
  { left: 0, top: 8, size: 13, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.6, delay: 0.58 },
  { left: 4, top: 2, size: 9, color: "#ffe066", shadow: "0 0 5px rgba(255,224,102,0.85)", dur: 0.55, delay: 0.02 },
  { left: 2, top: 14, size: 8, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.65, delay: 0.27 },
  { left: 8, top: 9, size: 12, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.5, delay: 0.05 },
  { left: 0, top: 16, size: 7, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.7, delay: 0.18 },
  { left: 6, top: 4, size: 10, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.58, delay: 0.24 },
  { left: 2, top: 9, size: 14, color: "#ffd93d", shadow: "0 0 7px rgba(255,217,61,0.9)", dur: 0.62, delay: 0.55 },
  { left: 5, top: 12, size: 8, color: "#ffe066", shadow: "0 0 4px rgba(255,224,102,0.85)", dur: 0.52, delay: 0.14 },
  { left: -4, top: 6, size: 11, color: "#ffd93d", shadow: "0 0 6px rgba(255,217,61,0.85)", dur: 0.63, delay: 0.03 },
  { left: -6, top: 11, size: 9, color: "#fff3b0", shadow: "0 0 5px rgba(255,243,176,0.85)", dur: 0.57, delay: 0.25 },
];

/** Signups the waitlist is treated as already carrying before this table's rows. */
export const BASELINE_SIGNUPS = 2700;

/**
 * Bar-relative stops. The milestone markers sit at the centres of four 23%-wide
 * columns laid out with space-between inside a track inset 2% each side, which
 * puts them at these percentages of the track. The BASELINE row is the design's
 * own at-rest state: at exactly 2,700 the fill must land on 50%, pixel-matching
 * the static design, and only advance once real signups push past it.
 */
const STOPS: { count: number; pct: number }[] = [
  { count: 0, pct: 0 },
  { count: 500, pct: 9.9 },
  { count: 2000, pct: 36.63 },
  { count: BASELINE_SIGNUPS, pct: 50 },
  { count: 5000, pct: 63.37 },
  { count: 10000, pct: 90.1 },
];

function progressFor(total: number): number {
  if (total <= 0) return 0;
  for (let i = 1; i < STOPS.length; i++) {
    const lo = STOPS[i - 1];
    const hi = STOPS[i];
    if (total <= hi.count) {
      const span = hi.count - lo.count;
      const t = span === 0 ? 0 : (total - lo.count) / span;
      return lo.pct + t * (hi.pct - lo.pct);
    }
  }
  // Past the final milestone the track fills the remaining stretch and stops.
  const last = STOPS[STOPS.length - 1];
  const over = Math.min(1, (total - last.count) / last.count);
  return Math.min(100, last.pct + over * (100 - last.pct));
}

type Props = { totalSignups: number; referralLink: string | null };

export default function SignupsRoadmap({ totalSignups, referralLink }: Props) {
  const progress = progressFor(totalSignups);
  // The track is inset 2% each side, so a track-relative percentage maps back
  // into the wrapper's coordinates this way. At the design's 50% this resolves
  // to exactly `calc(50% - 14px)`, the literal value in the design file.
  const sparkLeft = 2 + progress * 0.96;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        padding: "0 0 60px",
        marginTop: -112,
      }}
    >
      <div
        style={{
          width: 680,
          height: 300,
          background: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 18px 60px rgba(16,24,40,0.08)",
          padding: 26,
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 26,
            border: "1px solid #eef0f3",
            borderRadius: 14,
          }}
        />
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            padding: "22px 24px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#141416",
              marginBottom: 24,
            }}
          >
            Sign-ups Roadmap
          </div>

          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 6,
                left: "2%",
                right: "2%",
                height: 5,
                borderRadius: 3,
                background: `linear-gradient(to right, #1877f2 0%, #1877f2 ${progress}%, #e9edf2 ${progress}%, #e9edf2 100%)`,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -6,
                left: `calc(${sparkLeft}% - 14px)`,
                width: 50,
                height: 20,
                pointerEvents: "none",
              }}
            >
              {SPARKS.map((s, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: s.left,
                    top: s.top,
                    fontSize: s.size,
                    color: s.color,
                    textShadow: s.shadow,
                    animation: `roadmapSparkle ${s.dur}s ease-out infinite`,
                    animationDelay: `${s.delay}s`,
                  }}
                >
                  ✦
                </span>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {MILESTONES.map((m) => {
                const reached = totalSignups >= m.count;
                return (
                  <div
                    key={m.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: "23%",
                      animation: `revealRight 0.55s ease-out ${m.delay}s both`,
                    }}
                  >
                    <Image
                      src={m.icon}
                      alt=""
                      width={m.size}
                      height={m.size}
                      style={{ objectFit: "contain", marginTop: m.pull }}
                    />
                    <div
                      style={{
                        marginTop: 12,
                        background: reached ? "#1877f2" : "#ffffff",
                        color: reached ? "#ffffff" : "#6b6f76",
                        border: reached ? "none" : "1px solid #e6eaf0",
                        fontSize: 9,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 10,
                      }}
                    >
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginTop: "auto",
              marginBottom: "auto",
              paddingTop: 14,
            }}
          >
            <MagneticLink href="javascript:void(0);">GitHub</MagneticLink>
            <MagneticLink href="https://x.com/Elia_ai_prompts">X/Twitter</MagneticLink>
            <MagneticLink href="https://www.reddit.com/user/Elia_ai_prompts/">Reddit</MagneticLink>
            <ShareButton link={referralLink} variant="pill" iconSize={11} />
          </div>
        </div>
      </div>
    </div>
  );
}
