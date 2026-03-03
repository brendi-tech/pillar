"use client";

import Image from "next/image";
import { ClientSideSection } from "./ClientSideSection";
import { DemoSection } from "./DemoSection";
import { DeploySection } from "./DeploySection";
import { EngineersSection } from "./EngineersSection";
import { FinalCTA } from "./FinalCTA";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingNavbar } from "./MarketingNavbar";
import { PricingSection } from "./PricingSection";
import { TopHeroSection } from "./TopHeroSection";

/**
 * MarketingPage
 *
 * New marketing landing page with updated design.
 * Route: /marketing (internal, rewritten from / on root domain)
 */
export function MarketingPage() {
  return (
    <div
      className="min-h-screen flex flex-col bg-[#F3EFE8]"
      style={{
        backgroundImage: "url('/marketing/stripe-pattern.png')",
        backgroundRepeat: "repeat",
      }}
    >
      <div className="flex flex-col min-h-screen relative">
        <div className="bg-[#1A1A1A] py-2">
          <div className="flex items-center justify-center gap-1.5 text-[13px] text-white/60">
            <span>Backed by</span>
            <a
              href="https://www.ycombinator.com/launches/PUQ-pillar-your-app-s-copilot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-[#F26522]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-3 h-3"
                  aria-hidden="true"
                >
                  <path
                    d="M4 4L12 14V20H12V14L20 4"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-white/80 font-medium">YC</span>
            </a>
            <span>,</span>
            <a
              href="https://www.matrixpartners.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/marketing/matrix-logo.png"
                alt="Matrix Partners"
                width={56}
                height={20}
                className="h-4 w-auto opacity-80"
              />
            </a>
            <span>and other great entrepreneurs & founders</span>
          </div>
        </div>
        <MarketingNavbar />

        {/* Main content */}
        <main className="flex-1 w-full mx-auto ">
          <TopHeroSection />
          <DemoSection />
          <EngineersSection />
          <ClientSideSection />
          <DeploySection />
          <PricingSection />
          <FinalCTA />
        </main>

        <MarketingFooter />
      </div>
    </div>
  );
}
