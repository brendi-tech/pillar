/**
 * Utilities for extracting company domain from email addresses.
 */

// Generic email providers that shouldn't be used for auto-fill
const GENERIC_EMAIL_DOMAINS = new Set([
  // Major free email providers
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.ca',
  'yahoo.com.au',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.de',
  'outlook.com',
  'outlook.co.uk',
  'live.com',
  'live.co.uk',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'zoho.com',
  'zohomail.com',
  'yandex.com',
  'yandex.ru',
  'mail.com',
  'email.com',
  'usa.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'fastmail.com',
  'fastmail.fm',
  'tutanota.com',
  'tutanota.de',
  'tuta.io',
  'hey.com',
  'mailbox.org',
  'posteo.de',
  'posteo.net',
  
  // Regional providers
  'qq.com',
  '163.com',
  '126.com',
  'sina.com',
  'naver.com',
  'daum.net',
  'hanmail.net',
  'rediffmail.com',
  'web.de',
  't-online.de',
  'orange.fr',
  'free.fr',
  'laposte.net',
  'sfr.fr',
  'libero.it',
  'virgilio.it',
  'tin.it',
  'seznam.cz',
  'wp.pl',
  'o2.pl',
  'interia.pl',
  'rambler.ru',
  'mail.ru',
  'bk.ru',
  'inbox.ru',
  'list.ru',
  
  // Disposable/temporary email indicators
  'tempmail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
  '10minutemail.com',
  'temp-mail.org',
]);

/**
 * Extract the domain from an email address.
 * @returns The domain part (lowercase), or null if invalid
 */
export function extractEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;
  
  const domain = parts[1];
  if (!domain || !domain.includes('.')) return null;
  
  return domain;
}

/**
 * Check if an email domain is a generic/free email provider.
 */
export function isGenericEmailDomain(domain: string): boolean {
  return GENERIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/**
 * Extract company domain from email if it's not a generic provider.
 * @returns The company domain, or null if it's generic/invalid
 */
export function extractCompanyDomain(email: string): string | null {
  const domain = extractEmailDomain(email);
  if (!domain) return null;
  
  if (isGenericEmailDomain(domain)) return null;
  
  return domain;
}

/**
 * Convert a domain to a likely website URL.
 * @returns URL in format "https://domain.com"
 */
export function domainToWebsiteUrl(domain: string): string {
  // Remove any subdomain prefixes that are clearly not the main site
  // e.g., "mail.company.com" -> "company.com"
  const parts = domain.split('.');
  
  // If it's a simple domain (company.com), use as-is
  if (parts.length <= 2) {
    return `https://${domain}`;
  }
  
  // For subdomains, try to get the main domain
  // But keep country TLDs like .co.uk
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  
  // Common country code second-level domains
  const countrySLDs = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
  
  if (countrySLDs.includes(sld) && tld.length === 2) {
    // It's like .co.uk, .com.au - keep 3 parts
    if (parts.length >= 3) {
      return `https://${parts.slice(-3).join('.')}`;
    }
  }
  
  // Otherwise, take the last 2 parts
  return `https://${parts.slice(-2).join('.')}`;
}
