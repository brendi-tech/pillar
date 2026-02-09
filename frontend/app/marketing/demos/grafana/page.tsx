import type { Metadata } from "next";
import { GrafanaDemoPage } from "./GrafanaDemoPage";

export const metadata: Metadata = {
  title: "Grafana Copilot Demo | Pillar",
  description:
    "Experience Pillar's AI-powered Grafana plugin. Navigate dashboards, write queries, and create visualizations with natural language.",
  metadataBase: new URL("https://trypillar.com"),
  alternates: {
    canonical: "/demos/grafana",
  },
  openGraph: {
    title: "Grafana Copilot Demo | Pillar",
    description:
      "Experience Pillar's AI-powered Grafana plugin. Navigate dashboards, write queries, and create visualizations with natural language.",
    url: "https://trypillar.com/demos/grafana",
    siteName: "Pillar",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Grafana Copilot Demo | Pillar",
    description:
      "Experience Pillar's AI-powered Grafana plugin. Navigate dashboards, write queries, and create visualizations with natural language.",
  },
};

/**
 * Grafana Demo Page
 *
 * Route: /marketing/demos/grafana (internal, rewritten from /demos/grafana on root domain)
 * Features an interactive iframe demo of the Grafana Copilot plugin with a writeup.
 */
export default function Page() {
  return <GrafanaDemoPage />;
}
