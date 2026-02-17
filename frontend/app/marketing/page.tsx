import { MarketingPage } from "@/components/MarketingPage/MarketingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pillar - The Product Copilot",
  description:
    "Turn user requests into client-side actions. Pillar navigates your UI, builds dashboards, and executes more actions to carry out tasks automatically.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Pillar - The Product Copilot",
    description:
      "Turn user requests into client-side actions. Pillar navigates your UI, builds dashboards, and executes more actions to carry out tasks automatically.",
    url: "https://trypillar.com",
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
