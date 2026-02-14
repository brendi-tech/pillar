/**
 * Utilities for validating embed/SDK allowed domains.
 *
 * Used by:
 * - SecuritySection (configure page UI)
 * - add_allowed_domain Pillar tool
 */

const DOMAIN_REGEX =
  /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*(\.[a-zA-Z]{2,})?(:\d+)?$/;

/**
 * Validate a domain string for the embed allowed-domains list.
 *
 * Accepts patterns like:
 * - example.com
 * - *.example.com (wildcard subdomain)
 * - localhost
 * - localhost:3000 (localhost with specific port)
 * - localhost:* (localhost with any port)
 * - sub.domain.com:8080 (domain with port)
 */
export function validateDomain(domain: string): boolean {
  // Special-case: localhost with wildcard port
  if (domain === "localhost:*") return true;

  return (
    DOMAIN_REGEX.test(domain) ||
    domain === "localhost" ||
    domain.startsWith("localhost:")
  );
}
