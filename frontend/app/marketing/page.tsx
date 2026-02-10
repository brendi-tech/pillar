import { MarketingPage } from "@/components/MarketingPage/MarketingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pillar - The Product Copilot",
  description:
    "Turn user requests into client-side actions. Pillar navigates your UI, builds dashboards, and executes more actions to carry out tasks automatically.",
  metadataBase: new URL("https://trypillar.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Pillar - The Product Copilot",
    description:
      "Turn user requests into client-side actions. Pillar navigates your UI, builds dashboards, and executes more actions to carry out tasks automatically.",
    url: "https://trypillar.com",
    siteName: "Pillar",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pillar - The Product Copilot",
    description:
      "Turn user requests into client-side actions. Pillar navigates your UI, builds dashboards, and executes more actions to carry out tasks automatically.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

/**
 * Marketing Home Page
 *
 * Route: /marketing (internal, rewritten from / on root domain)
 */
export default function HomePage() {
  return <MarketingPage />;
}
