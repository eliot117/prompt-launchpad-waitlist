import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

const SITE_URL = "https://prompt-launchpad-waitlist.vercel.app";
const LOGO_URL = `${SITE_URL}/assets/prompt-launchpad-logo.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Prompt Launchpad",
  description:
    "Prompt Launchpad turns a rough idea into the best prompt possible before it ever reaches an AI. Join the waitlist.",
  openGraph: {
    title: "Prompt Launchpad",
    description:
      "Turn a rough idea into the best prompt possible. Join the waitlist.",
    type: "website",
    images: [{ url: LOGO_URL, width: 215, height: 215, alt: "Prompt Launchpad" }],
  },
  twitter: {
    // "summary" (not summary_large_image) is the right card type for a small
    // square logo — summary_large_image expects a ~1200x630 landscape image
    // and will crop/misrender a square one.
    card: "summary",
    title: "Prompt Launchpad",
    description:
      "Turn a rough idea into the best prompt possible. Join the waitlist.",
    images: [LOGO_URL],
  },
  icons: {
    icon: { url: "/assets/prompt-launchpad-logo.png", type: "image/png" },
    shortcut: { url: "/assets/prompt-launchpad-logo.png", type: "image/png" },
    apple: { url: "/assets/prompt-launchpad-logo.png", type: "image/png" },
  },
};

export const viewport: Viewport = { themeColor: "#1877f2" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
