/**
 * Shared plan tier data used across onboarding, pricing, and billing pages.
 */

export type BillingInterval = "monthly" | "yearly";

export interface PlanTier {
  name: string;
  label: string;
  description: string;
  price: number;
  priceLabel: string;
  priceSubtext?: string;
  responseLimit: string;
  responseLimitNumber: number | null;
  ctaText: string;
  ctaSubtext: string;
  features: string[];
  highlighted?: boolean;
  /** Stripe price ID key matching STRIPE_PRICE_IDS in settings */
  stripePriceKey?: string;
  badge: { text: string; bg: string; color: string };
  /** Yearly pricing override (20% off monthly, billed annually) */
  yearly?: {
    price: number;
    priceLabel: string;
    stripePriceKey: string;
  };
}

export const PLAN_TIERS: PlanTier[] = [
  {
    name: "free",
    label: "Free",
    description: "Try Pillar risk-free. No cost, no card.",
    price: 0,
    priceLabel: "$0",
    priceSubtext: "one-time",
    responseLimit: "50 responses (one-time)",
    responseLimitNumber: 50,
    ctaText: "Get Started Free",
    ctaSubtext: "No card required",
    features: [
      "Actions (execute, pre-fill)",
      "Analytics dashboard",
      "Widget customization",
    ],
    badge: { text: "FREE", bg: "rgba(11, 35, 142, 0.32)", color: "#95B7FF" },
  },
  {
    name: "hobby",
    label: "Hobby",
    description: "For side projects",
    price: 19,
    priceLabel: "$19",
    priceSubtext: "per month",
    responseLimit: "100 responses/mo",
    responseLimitNumber: 100,
    ctaText: "Get Started",
    ctaSubtext: "Then $0.25/response",
    features: [
      "Actions (execute, pre-fill)",
      "Analytics dashboard",
      "Widget customization",
    ],
    stripePriceKey: "hobby_monthly",
    badge: { text: "HOBBY", bg: "rgba(11, 142, 64, 0.32)", color: "#4EE479" },
    yearly: {
      price: 15,
      priceLabel: "$15",
      stripePriceKey: "hobby_yearly",
    },
  },
  {
    name: "pro",
    label: "Pro",
    description: "For production apps",
    price: 99,
    priceLabel: "$99",
    priceSubtext: "per month",
    responseLimit: "400 responses/mo",
    responseLimitNumber: 400,
    ctaText: "Get Started",
    ctaSubtext: "Then $0.20/response",
    highlighted: true,
    features: ["Everything in Hobby", "Priority support"],
    stripePriceKey: "pro_monthly",
    badge: { text: "PRO", bg: "#954509", color: "#FF6E00" },
    yearly: {
      price: 79,
      priceLabel: "$79",
      stripePriceKey: "pro_yearly",
    },
  },
  {
    name: "growth",
    label: "Growth",
    description: "For scaling apps",
    price: 249,
    priceLabel: "$249",
    priceSubtext: "per month",
    responseLimit: "1,500 responses/mo",
    responseLimitNumber: 1500,
    ctaText: "Get Started",
    ctaSubtext: "Then $0.15/response",
    features: ["Everything in Pro", "Custom integrations"],
    stripePriceKey: "growth_monthly",
    badge: {
      text: "GROWTH",
      bg: "rgba(142, 11, 84, 0.32)",
      color: "#FF78CB",
    },
    yearly: {
      price: 199,
      priceLabel: "$199",
      stripePriceKey: "growth_yearly",
    },
  },
];

/**
 * Returns a tier with price/key adjusted for the selected billing interval.
 * Free tier and tiers without yearly data are returned unchanged.
 */
export function getTierForInterval(
  tier: PlanTier,
  interval: BillingInterval
): PlanTier {
  if (interval === "yearly" && tier.yearly) {
    return {
      ...tier,
      price: tier.yearly.price,
      priceLabel: tier.yearly.priceLabel,
      priceSubtext: "per month",
      stripePriceKey: tier.yearly.stripePriceKey,
    };
  }
  return tier;
}

export function getPlanTier(planName: string): PlanTier | undefined {
  return PLAN_TIERS.find((t) => t.name === planName);
}

export function getPaidTiers(): PlanTier[] {
  return PLAN_TIERS.filter((t) => t.name !== "free");
}
