import { MarketingPage } from "@/components/MarketingPage/MarketingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pillar - Your App's Copilot",
  description:
    "Pillar is an open source copilot that turns user and agent requests into completed actions, right inside your app.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Pillar - Your App's Copilot",
    description:
      "Pillar is an open source copilot that turns user and agent requests into completed actions, right inside your app.",
    url: "https://trypillar.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pillar - Your App's Copilot",
    description:
      "Pillar is an open source copilot that turns user and agent requests into completed actions, right inside your app.",
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
