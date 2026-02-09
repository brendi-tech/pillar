"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { CurrentPlanCard } from "./CurrentPlanCard";
import { UsageOverview } from "./UsageOverview";
import { InvoiceHistory } from "./InvoiceHistory";
import { UsageAlertsSection } from "./UsageAlertsSection";

// Types for billing state
export interface UsageAlert {
  enabled: boolean;
  threshold: number;
  channel: "email" | "slack";
}

export interface BillingState {
  plan: {
    name: string;
    price: number;
    billingCycle: "monthly" | "annual";
    nextBillingDate: string;
  };
  usage: {
    apiCalls: { used: number; limit: number };
    storage: { used: number; limit: number };
    seats: { used: number; limit: number };
  };
  alerts: UsageAlert;
}

// Global state for Pillar card access (cards render outside React tree)
let globalBillingState: BillingState | null = null;
let globalUpdateAlerts: ((alerts: Partial<UsageAlert>) => void) | null = null;

export function getGlobalBillingState() {
  return globalBillingState;
}

export function getGlobalUpdateAlerts() {
  return globalUpdateAlerts;
}

// Mock initial data
const initialBillingState: BillingState = {
  plan: {
    name: "Pro",
    price: 99,
    billingCycle: "monthly",
    nextBillingDate: "2026-02-20",
  },
  usage: {
    apiCalls: { used: 8420, limit: 10000 },
    storage: { used: 2.4, limit: 5 }, // GB
    seats: { used: 4, limit: 5 },
  },
  alerts: {
    enabled: false,
    threshold: 500,
    channel: "email",
  },
};

export function BillingPageContent() {
  const searchParams = useSearchParams();
  const [billingState, setBillingState] =
    useState<BillingState>(initialBillingState);
  const [highlightAlerts, setHighlightAlerts] = useState(false);

  // Check URL param to auto-expand alerts section
  const sectionParam = searchParams.get("section");

  useEffect(() => {
    if (sectionParam === "alerts") {
      setHighlightAlerts(true);
      // Remove highlight after animation
      const timer = setTimeout(() => setHighlightAlerts(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [sectionParam]);

  const updateAlerts = (alerts: Partial<UsageAlert>) => {
    setBillingState((prev) => ({
      ...prev,
      alerts: { ...prev.alerts, ...alerts },
    }));
  };

  // Update global state for Pillar cards
  useEffect(() => {
    globalBillingState = billingState;
    globalUpdateAlerts = updateAlerts;
  }, [billingState]);

  return (
    <div className="space-y-6">
      {/* Top row: Plan and Usage */}
      <div className="grid gap-6 md:grid-cols-2">
        <CurrentPlanCard plan={billingState.plan} />
        <UsageOverview usage={billingState.usage} />
      </div>

      {/* Usage Alerts Section */}
      <UsageAlertsSection
        alerts={billingState.alerts}
        onUpdate={updateAlerts}
        defaultExpanded={sectionParam === "alerts"}
        highlight={highlightAlerts}
      />

      {/* Invoice History */}
      <InvoiceHistory />
    </div>
  );
}
