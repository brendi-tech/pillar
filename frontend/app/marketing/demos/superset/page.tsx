import type { Metadata } from "next";
import { SupersetDemoPage } from "./SupersetDemoPage";

export const metadata: Metadata = {
  title: "Superset Copilot Demo | Pillar",
  description:
    "Experience Pillar's AI-powered assistant for Apache Superset. Explore dashboards, create charts, and query data with natural language.",
  alternates: {
    canonical: "/demos/superset",
  },
  openGraph: {
    title: "Superset Copilot Demo | Pillar",
    description:
      "Experience Pillar's AI-powered assistant for Apache Superset. Explore dashboards, create charts, and query data with natural language.",
    url: "https://trypillar.com/demos/superset",
    siteName: "Pillar",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-card.png",
        width: 1280,
        height: 640,
        alt: "Pillar - The open-source product copilot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Superset Copilot Demo | Pillar",
    description:
      "Experience Pillar's AI-powered assistant for Apache Superset. Explore dashboards, create charts, and query data with natural language.",
    images: ["/og-card.png"],
  },
};

/**
 * Superset Demo Page
 *
 * Route: /marketing/demos/superset (internal, rewritten from /demos/superset on root domain)
 * Features an interactive iframe demo of the Superset + Pillar integration.
 */
export default function Page() {
  return <SupersetDemoPage />;
}
