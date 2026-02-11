"use client";

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
