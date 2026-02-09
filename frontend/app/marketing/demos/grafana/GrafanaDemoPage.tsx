"use client";

import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import { ArrowRight, ExternalLink, Github, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Demo URL - Cloud Run service URL (no custom domain since subdomains are reserved)
// After deploying, update this or set NEXT_PUBLIC_GRAFANA_DEMO_URL env var
const GRAFANA_DEMO_URL =
  process.env.NEXT_PUBLIC_GRAFANA_DEMO_URL ||
  "https://grafana-copilot-demo-xxxxxxxxxx-uc.a.run.app";

const features = [
  {
    title: "Natural Language Navigation",
    description:
      "Navigate to any dashboard, explore queries, or manage alerts just by asking.",
  },
  {
    title: "Query Assistance",
    description:
      "Get help writing PromQL, LogQL, or SQL queries with AI-powered suggestions.",
  },
  {
    title: "Dashboard Creation",
    description:
      "Create new panels and dashboards from natural language descriptions.",
  },
  {
    title: "Alert Management",
    description:
      "View firing alerts, create silences, and manage alerting rules conversationally.",
  },
];

/**
 * GrafanaDemoPage - Interactive demo page for the Grafana Copilot plugin
 * Features a writeup section and a full-height iframe embed of the live demo.
 */
export function GrafanaDemoPage() {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F3EFE8] flex flex-col">
      {/* Navigation */}
      <MarketingNavbar onOpenWaitlist={() => setIsWaitlistOpen(true)} />

      {/* Hero Section */}
      <section className="pt-12 pb-8 lg:pt-16 lg:pb-12">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FF6E00]/10 text-[#FF6E00] text-sm font-medium">
              <Zap className="h-4 w-4" />
              Interactive Demo
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1A1A1A] text-center leading-tight mb-6">
            Grafana Copilot
          </h1>

          {/* Description */}
          <p className="text-lg text-[#6B6B6B] text-center max-w-2xl mx-auto mb-8">
            An AI-powered assistant for Grafana that helps you navigate
            dashboards, write queries, create visualizations, and manage alerts
            using natural language.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="https://github.com/AskPillar/pillar-examples/tree/main/grafana-copilot"
              target="_blank"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1A1A1A] text-white font-medium hover:bg-[#333] transition-colors"
            >
              <Github className="h-5 w-5" />
              View Source
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="/docs/integrations/grafana"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#1A1A1A] text-[#1A1A1A] font-medium hover:bg-[#1A1A1A] hover:text-white transition-colors"
            >
              Integration Guide
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="pb-8 lg:pb-12">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl p-5 border border-[#E5E0D8]"
              >
                <h3 className="font-semibold text-[#1A1A1A] mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[#6B6B6B]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Instructions */}
      <section className="pb-6">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="bg-[#1A1A1A] rounded-xl p-6 text-white">
            <h2 className="text-lg font-semibold mb-3">Try the Demo</h2>
            <ol className="list-decimal list-inside space-y-2 text-[#E5E0D8]">
              <li>
                Look for the{" "}
                <span className="text-[#FF6E00] font-medium">
                  orange edge trigger
                </span>{" "}
                on the right side of the screen
              </li>
              <li>Click it or hover to open the Pillar assistant</li>
              <li>
                Try asking:{" "}
                <span className="italic">
                  &quot;Show me the sample dashboard&quot;
                </span>{" "}
                or{" "}
                <span className="italic">
                  &quot;What datasources are available?&quot;
                </span>
              </li>
              <li>
                Explore queries, create panels, or navigate Grafana with natural
                language
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Iframe Demo Section */}
      <section className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto h-full">
          <div className="relative h-[70vh] lg:h-[75vh] rounded-xl overflow-hidden border-2 border-[#1A1A1A] shadow-2xl bg-white">
            {/* Browser Chrome Header */}
            <div className="absolute top-0 left-0 right-0 h-10 bg-[#1A1A1A] flex items-center px-4 z-10">
              {/* Window Controls */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28CA41]" />
              </div>
              {/* URL Bar */}
              <div className="flex-1 flex justify-center">
                <div className="bg-[#333] rounded-md px-4 py-1 text-sm text-[#999] max-w-md w-full text-center">
                  trypillar.com/demos/grafana
                </div>
              </div>
              {/* Open in new tab */}
              <Link
                href={GRAFANA_DEMO_URL}
                target="_blank"
                className="text-[#999] hover:text-white transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            {/* Iframe */}
            <iframe
              src={GRAFANA_DEMO_URL}
              className="w-full h-full border-0 pt-10"
              title="Grafana Copilot Demo"
              allow="clipboard-write"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 bg-white border-t border-[#E5E0D8]">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#1A1A1A] mb-4">
            Ready to add AI to your Grafana?
          </h2>
          <p className="text-[#6B6B6B] mb-8">
            The Grafana Copilot plugin is open source and easy to install. Add
            Pillar&apos;s AI assistant to your self-hosted Grafana in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/docs/integrations/grafana"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-[#FF6E00] text-white font-medium hover:bg-[#E06200] transition-colors"
            >
              Get Started
              <ArrowRight className="h-5 w-5" />
            </Link>
            <button
              onClick={() => setIsWaitlistOpen(true)}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg border border-[#1A1A1A] text-[#1A1A1A] font-medium hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
            >
              Join Waitlist
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <MarketingFooter />
    </div>
  );
}
