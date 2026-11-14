import type { Metadata } from "next";

const ORIGIN = "https://prompt-launchpad-waitlist.vercel.app";

export function publicPageMetadata(path: "/about" | "/how-it-works" | "/privacy", title: string, description: string): Metadata {
  const image = `${ORIGIN}/assets/prompt-launchpad-logo.png`;
  return {
    title,
    description,
    alternates: { canonical: `${ORIGIN}${path}` },
    openGraph: {
      title,
      description,
      url: `${ORIGIN}${path}`,
      siteName: "Prompt Launchpad",
      type: "website",
      images: [{ url: image, width: 215, height: 215, alt: "Prompt Launchpad" }],
    },
    twitter: { card: "summary", title, description, images: [image] },
  };
}
