"use client";

import { useState } from "react";
import { WaitlistModal } from "../marketing/LandingPage/EarlyAccessModal";
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
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [waitlistEntryId, setWaitlistEntryId] = useState<string | null>(null);
  const [waitlistInitialStep, setWaitlistInitialStep] = useState<
    "email" | "details" | "complete"
  >("email");

  const openWaitlist = (entryId?: string) => {
    if (entryId) {
      setWaitlistEntryId(entryId);
      setWaitlistInitialStep("details");
    } else {
      setWaitlistEntryId(null);
      setWaitlistInitialStep("email");
    }
    setWaitlistModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setWaitlistModalOpen(open);
    if (!open) {
      setWaitlistEntryId(null);
      setWaitlistInitialStep("email");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-[#F3EFE8]"
      style={{
        backgroundImage: "url('/marketing/stripe-pattern.png')",
        backgroundRepeat: "repeat",
      }}
    >
      <div className="flex flex-col min-h-screen relative">
        <MarketingNavbar onOpenWaitlist={() => openWaitlist()} />

        {/* Main content */}
        <main className="flex-1 w-full mx-auto ">
          <TopHeroSection onOpenWaitlist={openWaitlist} />
          <DemoSection />
          <EngineersSection />
          <ClientSideSection />
          <DeploySection />
          <PricingSection onOpenWaitlist={() => openWaitlist()} />
          <FinalCTA onOpenWaitlist={() => openWaitlist()} />
        </main>

        <MarketingFooter />

        <WaitlistModal
          open={waitlistModalOpen}
          onOpenChange={handleModalOpenChange}
          initialEntryId={waitlistEntryId}
          initialStep={waitlistInitialStep}
        />
      </div>
    </div>
  );
}
