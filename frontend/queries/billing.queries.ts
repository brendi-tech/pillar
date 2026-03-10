/**
 * TanStack Query configuration for billing API endpoints.
 */

import { adminFetch, adminPost } from "@/lib/admin/api-client";
import { queryOptions } from "@tanstack/react-query";

// =============================================================================
// Types
// =============================================================================

export interface SubscriptionData {
  plan: string;
  subscription_status: string;
  monthly_responses: number | null;
  is_one_time: boolean;
  has_payg: boolean;
  stripe_subscription_id: string | null;
  billing_interval?: "monthly" | "yearly";
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  pending_downgrade?: {
    plan: string;
    effective_date: number;
  };
}

export interface BonusGrant {
  amount: number;
  expires_at: string | null;
  memo: string;
}

export interface UsageData {
  used: number;
  limit: number | null;
  plan_limit: number | null;
  bonus_total: number;
  bonus_used: number;
  bonus_grants: BonusGrant[];
  is_one_time: boolean;
  plan: string;
  has_payg: boolean;
  payg_rate: string | null;
}

export interface CheckoutResponse {
  url?: string;
  /** Present when the backend updated an existing subscription in-place (upgrade) */
  updated?: boolean;
  /** Present when a downgrade has been scheduled for end of billing period */
  scheduled?: boolean;
  /** Unix timestamp when the scheduled change takes effect */
  effective_date?: number;
  plan?: string;
  subscription_status?: string;
  monthly_responses?: number | null;
}

export interface PortalResponse {
  url: string;
}

// =============================================================================
// Query Keys Factory
// =============================================================================

export const billingKeys = {
  all: ["billing"] as const,
  subscription: () => [...billingKeys.all, "subscription"] as const,
  usage: () => [...billingKeys.all, "usage"] as const,
};

// =============================================================================
// Query Options
// =============================================================================

export const billingSubscriptionQuery = () =>
  queryOptions({
    queryKey: billingKeys.subscription(),
    queryFn: () => adminFetch<SubscriptionData>("/billing/subscription/"),
  });

export const billingUsageQuery = () =>
  queryOptions({
    queryKey: billingKeys.usage(),
    queryFn: () => adminFetch<UsageData>("/billing/usage/"),
  });

// =============================================================================
// Mutations
// =============================================================================

export const createCheckoutMutation = () => ({
  mutationFn: ({
    priceId,
    successUrl,
    cancelUrl,
  }: {
    priceId: string;
    successUrl?: string;
    cancelUrl?: string;
  }) =>
    adminPost<CheckoutResponse>("/billing/checkout/", {
      price_id: priceId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
});

export const createPortalMutation = () => ({
  mutationFn: () => adminPost<PortalResponse>("/billing/portal/", {}),
});

export const verifyCheckoutSessionMutation = () => ({
  mutationFn: ({ sessionId }: { sessionId: string }) =>
    adminPost<SubscriptionData>("/billing/verify-session/", {
      session_id: sessionId,
    }),
});

export const cancelSubscriptionMutation = () => ({
  mutationFn: () =>
    adminPost<{ canceled: boolean }>("/billing/cancel/", {}),
});

export const cancelDowngradeMutation = () => ({
  mutationFn: () =>
    adminPost<{ canceled: boolean }>("/billing/cancel-downgrade/", {}),
});
