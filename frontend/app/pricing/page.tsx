"use client";

import { useEffect, useState } from "react";
import { PricingSection } from "@/components/MarketingPage/PricingSection";
import { getStoredAccessToken } from "@/lib/admin/api-client";
import { apiClient } from "@/lib/admin/api-client";

/**
 * Pricing Page
 *
 * Standalone pricing page reusing the PricingSection component.
 * Detects signed-in users via shared auth cookies and highlights their current plan.
 */
export default function PricingPage() {
  const [activePlan, setActivePlan] = useState<string | undefined>();

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;

    apiClient
      .get("/api/billing/subscription/")
      .then((res) => {
        if (res.data?.plan) {
          setActivePlan(res.data.plan);
        }
      })
      .catch(() => {
        // Not authenticated or no subscription — show default pricing
      });
  }, []);

  return <PricingSection hideNumberedHeading activePlan={activePlan} />;
}
