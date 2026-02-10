"use client";

import { PricingSection } from "@/components/MarketingPage/PricingSection";
import { WaitlistModal } from "@/components/marketing/LandingPage/EarlyAccessModal";
import { useState } from "react";

/**
 * Pricing Page
 *
 * Standalone pricing page reusing the PricingSection component
 * from the marketing homepage.
 */
export default function PricingPage() {
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
    <>
      <PricingSection onOpenWaitlist={() => openWaitlist()} hideNumberedHeading />

      <WaitlistModal
        open={waitlistModalOpen}
        onOpenChange={handleModalOpenChange}
        initialEntryId={waitlistEntryId}
        initialStep={waitlistInitialStep}
      />
    </>
  );
}
