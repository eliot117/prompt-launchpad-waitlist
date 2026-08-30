import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prompt Launchpad",
  description:
    "Prompt Launchpad turns a rough idea into the best prompt possible before it ever reaches an AI. Join the waitlist.",
  openGraph: {
    title: "Prompt Launchpad",
    description:
      "Turn a rough idea into the best prompt possible. Join the waitlist.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt Launchpad",
    description:
      "Turn a rough idea into the best prompt possible. Join the waitlist.",
  },
  icons: { icon: "/assets/prompt-launchpad-logo.png" },
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
