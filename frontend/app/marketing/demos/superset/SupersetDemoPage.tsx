"use client";

import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

const SUPERSET_DEMO_URL =
  process.env.NEXT_PUBLIC_SUPERSET_DEMO_URL ||
  "https://superset.trypillar.com";

export function SupersetDemoPage() {
  return (
    <div
      className="min-h-screen flex flex-col bg-[#F3EFE8]"
      style={{
        backgroundImage: "url('/marketing/stripe-pattern.png')",
        backgroundRepeat: "repeat",
      }}
    >
      <MarketingNavbar />

      <main className="flex-1 flex flex-col max-w-marketingSection mx-auto border-x border-marketing bg-white w-full">
        <div className="flex items-center justify-between px-6 sm:px-10 lg:px-16 py-6 sm:py-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#1A1A1A] tracking-tight">
            Superset Copilot
          </h1>
          <Link
            href={SUPERSET_DEMO_URL}
            target="_blank"
            className="inline-flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] border border-[#1A1A1A]/15 rounded-lg px-4 py-2 transition-colors"
          >
            Open in new tab
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="h-[80vh]">
          <div className="h-9 bg-[#1A1A1A] flex items-center px-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-[#333] rounded-md px-4 py-0.5 text-xs text-[#999] max-w-sm w-full text-center">
                trypillar.com/demos/superset
              </div>
            </div>
            <Link
              href={SUPERSET_DEMO_URL}
              target="_blank"
              className="text-[#999] hover:text-white transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          <iframe
            src={SUPERSET_DEMO_URL}
            className="w-full border-0"
            style={{ height: "calc(100% - 2.25rem)" }}
            title="Superset Copilot Demo"
            allow="clipboard-write"
            loading="lazy"
          />
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
