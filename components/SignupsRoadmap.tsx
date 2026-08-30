"use client";

import Image from "next/image";

const MILESTONES = [
  { icon: "/uploads/bicycle.png", size: 28, pull: -6, label: "500+", delay: 0.2, reached: true },
  { icon: "/uploads/sport-car.png", size: 40, pull: -12, label: "2,000+", delay: 0.35, reached: true },
  { icon: "/uploads/airplane.png", size: 52, pull: -18, label: "5,000+", delay: 0.5, reached: false },
  { icon: "/uploads/rocket.png", size: 40, pull: -12, label: "10,000+", delay: 0.65, reached: false },
];

const SPARKS = [
  { left: 0, top: 8, size: 13, color: "#ffd93d", dur: 0.6, delay: 0.23 },
  { left: 4, top: 2, size: 9, color: "#ffe066", dur: 0.55, delay: 0.08 },
  { left: 2, top: 14, size: 8, color: "#fff3b0", dur: 0.65, delay: 0.11 },
  { left: 8, top: 9, size: 12, color: "#ffd93d", dur: 0.5, delay: 0.34 },
  { left: 0, top: 16, size: 7, color: "#ffe066", dur: 0.7, delay: 0.03 },
  { left: 6, top: 4, size: 10, color: "#fff3b0", dur: 0.58, delay: 0.31 },
  { left: 2, top: 9, size: 14, color: "#ffd93d", dur: 0.62, delay: 0.06 },
  { left: 5, top: 12, size: 8, color: "#ffe066", dur: 0.52, delay: 0.28 },
  { left: -4, top: 6, size: 11, color: "#ffd93d", dur: 0.63, delay: 0.49 },
  { left: -6, top: 11, size: 9, color: "#fff3b0", dur: 0.57, delay: 0.34 },
  { left: 3, top: 5, size: 10, color: "#ffe066", dur: 0.6, delay: 0.42 },
  { left: -2, top: 13, size: 12, color: "#ffd93d", dur: 0.54, delay: 0.17 },
];

/** Progress is the design's fixed 50%; it is not wired to the live count. */
const PROGRESS = 50;

export default function SignupsRoadmap() {
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
          maxWidth: "100%",
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
                background: `linear-gradient(to right, #1877f2 0%, #1877f2 ${PROGRESS}%, #e9edf2 ${PROGRESS}%, #e9edf2 100%)`,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -6,
                left: `calc(${PROGRESS}% - 14px)`,
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
                    textShadow: `0 0 6px ${s.color}d9`,
                    animation: `roadmapSparkle ${s.dur}s ease-out infinite`,
                    animationDelay: `${s.delay}s`,
                  }}
                >
                  ✦
                </span>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {MILESTONES.map((m) => (
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
                        background: m.reached ? "#1877f2" : "#ffffff",
                        color: m.reached ? "#ffffff" : "#6b6f76",
                        border: m.reached ? "none" : "1px solid #e6eaf0",
                        fontSize: 9,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 10,
                      }}
                    >
                      {m.label}
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
