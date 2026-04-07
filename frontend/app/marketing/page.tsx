import { MarketingPage } from "@/components/MarketingPage/MarketingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pillar - The Control Plane for AI Agents",
  description:
    "Pillar is the open source agent platform. Connect your tools once — Pillar adds reasoning, knowledge, multi-channel deployment, and a dashboard to manage it all.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Pillar - The Control Plane for AI Agents",
    description:
      "Pillar is the open source agent platform. Connect your tools once — Pillar adds reasoning, knowledge, multi-channel deployment, and a dashboard to manage it all.",
    url: "https://trypillar.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pillar - The Control Plane for AI Agents",
    description:
      "Pillar is the open source agent platform. Connect your tools once — Pillar adds reasoning, knowledge, multi-channel deployment, and a dashboard to manage it all.",
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
