/**
 * TanStack Query configurations for Help Center Config API.
 *
 * Includes queries and mutations for help center configuration,
 * branding, and custom domain management.
 */

import {
    getConfig,
    getDomainStatus,
    updateConfig,
    uploadFavicon,
    uploadLogo,
    uploadOGImage,
    verifyDomain,
} from "@/lib/admin/config-api";
import type { UpdateConfigPayload } from "@/types/config";
import { queryOptions } from "@tanstack/react-query";

// =============================================================================
// Query Keys Factory
// =============================================================================

export const configKeys = {
  all: ["config"] as const,

  // Site config
  details: () => [...configKeys.all, "detail"] as const,
  detail: (siteId: string) => [...configKeys.details(), siteId] as const,

  // Domain status
  domain: () => [...configKeys.all, "domain"] as const,
  domainStatus: (siteId: string) =>
    [...configKeys.domain(), "status", siteId] as const,
};

// =============================================================================
// Query Options
// =============================================================================

/**
 * Get the help center configuration for a site
 */
export const helpCenterConfigQuery = (siteId: string) =>
  queryOptions({
    queryKey: configKeys.detail(siteId),
    queryFn: () => getConfig(siteId),
  });

/**
 * Get custom domain status
 */
export const domainStatusQuery = (siteId: string) =>
  queryOptions({
    queryKey: configKeys.domainStatus(siteId),
    queryFn: () => getDomainStatus(siteId),
  });

// =============================================================================
// Mutations
// =============================================================================

/**
 * Update the help center configuration
 */
export const updateConfigMutation = () => ({
  mutationFn: ({
    siteId,
    payload,
  }: {
    siteId: string;
    payload: UpdateConfigPayload;
  }) => updateConfig(siteId, payload),
});

/**
 * Upload a logo (light or dark mode)
 */
export const uploadLogoMutation = () => ({
  mutationFn: ({
    siteId,
    file,
    type,
  }: {
    siteId: string;
    file: File;
    type: "light" | "dark";
  }) => uploadLogo(siteId, file, type),
});

/**
 * Upload a favicon
 */
export const uploadFaviconMutation = () => ({
  mutationFn: ({ siteId, file }: { siteId: string; file: File }) =>
    uploadFavicon(siteId, file),
});

/**
 * Upload an OG image for social sharing
 */
export const uploadOGImageMutation = () => ({
  mutationFn: ({ siteId, file }: { siteId: string; file: File }) =>
    uploadOGImage(siteId, file),
});

/**
 * Verify custom domain ownership
 */
export const verifyDomainMutation = () => ({
  mutationFn: ({ siteId, domain }: { siteId: string; domain: string }) =>
    verifyDomain(siteId, domain),
});
