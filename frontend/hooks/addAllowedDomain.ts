/**
 * Extracted execute logic for the add_allowed_domain Pillar tool.
 *
 * Separated from usePillarTools so it can be unit-tested without
 * React provider dependencies.
 */

import { validateDomain } from "@/lib/utils/domain-validation";

/** Minimal product shape needed by the execute function. */
export interface AddAllowedDomainProduct {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: Record<string, any>;
}

/** Injectable dependencies for the execute function. */
export interface AddAllowedDomainDeps {
  currentProduct: AddAllowedDomainProduct | null;
  adminPatch: (endpoint: string, data: unknown) => Promise<unknown>;
  invalidateQueries: () => void;
  nav: (path: string) => void;
}

type Result = { success: boolean; message?: string; error?: string };

/**
 * Core logic for adding a domain to the embed allowed-domains list.
 *
 * 1. Validates the product exists
 * 2. Normalises & validates the domain string
 * 3. Checks for duplicates
 * 4. PATCHes the config via adminPatch
 * 5. Invalidates queries & navigates
 */
export async function executeAddAllowedDomain(
  data: { domain?: string },
  deps: AddAllowedDomainDeps
): Promise<Result> {
  const { currentProduct, adminPatch, invalidateQueries, nav } = deps;

  if (!currentProduct?.id) {
    return { success: false, error: "No product selected" };
  }

  const domain = data.domain?.trim().toLowerCase();
  if (!domain) {
    return { success: false, error: "Domain is required" };
  }

  if (!validateDomain(domain)) {
    return {
      success: false,
      error:
        "Invalid domain. Use formats like example.com, *.example.com, or localhost:3000",
    };
  }

  const existingDomains: string[] =
    currentProduct.config?.embed?.security?.allowedDomains ?? [];

  if (existingDomains.includes(domain)) {
    return { success: false, error: `"${domain}" is already in the allowed domains list` };
  }

  try {
    await adminPatch(`/configs/${currentProduct.id}/`, {
      config: {
        ...currentProduct.config,
        embed: {
          ...currentProduct.config?.embed,
          security: {
            ...currentProduct.config?.embed?.security,
            allowedDomains: [...existingDomains, domain],
          },
        },
      },
    });

    invalidateQueries();
    nav("/configure");

    return {
      success: true,
      message: `Added "${domain}" to allowed domains`,
    };
  } catch {
    return { success: false, error: "Failed to add allowed domain" };
  }
}
