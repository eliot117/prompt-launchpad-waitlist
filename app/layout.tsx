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

const TITLE = "Prompt Launchpad — Write Better AI Prompts with Elia";
const DESCRIPTION =
  "Prompt Launchpad turns any rough idea into a production-ready Master Prompt for any AI — written by Elia. Join the waitlist and start earning referral rewards.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  verification: {
    google: "Hx1dHPKZmmPHMV8_UXEY-CIDnsz1dLnJ6VoRUkt9CPw",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Prompt Launchpad",
    type: "website",
    images: [{ url: LOGO_URL, width: 215, height: 215, alt: "Prompt Launchpad" }],
  },
  twitter: {
    // "summary" (not summary_large_image) is the right card type for a small
    // square logo — summary_large_image expects a ~1200x630 landscape image
    // and will crop/misrender a square one.
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: [LOGO_URL],
  },
  icons: {
    icon: { url: "/assets/prompt-launchpad-logo.png", type: "image/png" },
    shortcut: { url: "/assets/prompt-launchpad-logo.png", type: "image/png" },
    apple: { url: "/assets/prompt-launchpad-logo.png", type: "image/png" },
  },
};

export const viewport: Viewport = { themeColor: "#1877f2" };

/**
 * Emitted as JSON-LD rather than via `metadata`, which has no vehicle for
 * arbitrary structured data. `availability: PreOrder` is the honest signal
 * while this is a waitlist rather than a shipped product.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Prompt Launchpad",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
      },
    },
    {
      "@type": "Organization",
      name: "Prompt Launchpad",
      url: SITE_URL,
      logo: LOGO_URL,
      sameAs: [
        "https://x.com/Elia_ai_prompts",
        "https://www.reddit.com/user/Elia_ai_prompts/",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        {children}
      </body>
    </html>
  );
}
