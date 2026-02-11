"use client";

import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

const GRAFANA_DEMO_URL =
  process.env.NEXT_PUBLIC_GRAFANA_DEMO_URL ||
  "https://grafana-copilot-demo-45583431749.us-central1.run.app";

/**
 * GrafanaDemoPage - Minimal demo page that lets the live Grafana iframe
 * speak for itself. Just navbar, a slim header, and the full-height embed.
 */
export function GrafanaDemoPage() {
  return (
    <div className="min-h-screen bg-[#F3EFE8] flex flex-col">
      <MarketingNavbar />

      {/* Slim header */}
      <div className="flex items-center justify-between max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/demos"
            className="text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
          >
            &larr; All demos
          </Link>
          <span className="text-[#D4D4D4]">/</span>
          <h1 className="text-sm font-medium text-[#1A1A1A]">
            Grafana Copilot
          </h1>
        </div>
        <Link
          href={GRAFANA_DEMO_URL}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
        >
          Open in new tab
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Full-height iframe */}
      <section className="flex-1 px-4 sm:px-6 lg:px-8 pb-6">
        <div className="max-w-7xl mx-auto h-full">
          <div className="relative h-[80vh] lg:h-[85vh] rounded-xl overflow-hidden border border-[#1A1A1A]/20 shadow-xl bg-white">
            {/* Browser chrome */}
            <div className="absolute top-0 left-0 right-0 h-9 bg-[#1A1A1A] flex items-center px-4 z-10">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-[#333] rounded-md px-4 py-0.5 text-xs text-[#999] max-w-sm w-full text-center">
                  trypillar.com/demos/grafana
                </div>
              </div>
              <Link
                href={GRAFANA_DEMO_URL}
                target="_blank"
                className="text-[#999] hover:text-white transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <iframe
              src={GRAFANA_DEMO_URL}
              className="w-full h-full border-0 pt-9"
              title="Grafana Copilot Demo"
              allow="clipboard-write"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
