import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple inline debug for middleware (can't import from lib in Edge runtime easily)
const DEBUG_ENABLED = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
const debugMiddleware = (message: string, data?: Record<string, unknown>) => {
  if (!DEBUG_ENABLED) return;
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}] [MIDDLEWARE] ${message}`, data ?? '');
};

// Short edge cache for marketing HTML/RSC responses.
const MARKETING_EDGE_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600';

/**
 * Middleware for Help Center Admin
 *
 * ARCHITECTURE:
 * 
 * ADMIN SUBDOMAIN - All admin functionality lives here:
 * - admin.localhost:3001 (local development)
 * - admin.pillar.bot (dev)
 * - admin.trypillar.com (production)
 * 
 * Routes on admin subdomain:
 * - /login - Sign in
 * - /signup - Sign up
 * - /onboarding - New user setup
 * - /knowledge - Knowledge sources (default page)
 * - /tasks - Action tasks
 * - /analytics - Analytics
 * - /settings - Help center settings
 * - / - Redirects to /knowledge
 * 
 * ROOT DOMAIN - Marketing landing page:
 * - localhost:3001 (local development)
 * - pillar.bot (dev)
 * - trypillar.com (production)
 * 
 * Note: We no longer host public help centers. Pillar is an embedded product 
 * assistant that indexes your existing help center (Zendesk, Intercom, etc.)
 * and serves content through the SDK.
 */

// Reserved subdomains
const RESERVED_SUBDOMAINS = new Set([
  'admin',     // Admin subdomain
  'app',       // Dashboard frontend (legacy)
  'api',       // Main backend API
  'ai',        // MCP/Agent API
  'help-api',  // Help Center backend
  'www',       // Marketing redirect
  'staging',   // Staging environment
]);

/**
 * Check if a subdomain/customer name is reserved.
 */
export function isReservedSubdomain(name: string): boolean {
  return RESERVED_SUBDOMAINS.has(name.toLowerCase());
}

/**
 * Check if this is the admin subdomain.
 */
function isAdminSubdomain(hostname: string): boolean {
  const hostnameWithoutPort = hostname.split(':')[0];
  return (
    hostnameWithoutPort === 'admin.localhost' ||
    hostnameWithoutPort === 'admin' ||
    hostnameWithoutPort === 'admin.pillar.bot' ||
    hostnameWithoutPort === 'admin.trypillar.com'
  );
}

/**
 * Check if this is a root domain (no subdomain) - marketing site.
 */
function isRootDomain(hostname: string): boolean {
  const hostnameWithoutPort = hostname.split(':')[0];
  
  if (hostnameWithoutPort === 'localhost' || hostnameWithoutPort === '127.0.0.1') {
    return true;
  }
  
  if (hostnameWithoutPort === 'trypillar.com' || hostnameWithoutPort === 'www.trypillar.com') {
    return true;
  }
  
  if (hostnameWithoutPort === 'pillar.bot' || hostnameWithoutPort === 'www.pillar.bot') {
    return true;
  }
  
  return false;
}

/**
 * Detect locale from request.
 */
function getLocaleFromRequest(request: NextRequest): string {
  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/([a-z]{2})\//);
  if (localeMatch) {
    return localeMatch[1];
  }
  
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const primaryLocale = acceptLanguage.split(',')[0].split('-')[0];
    return primaryLocale;
  }
  
  return 'en';
}

/**
 * Get admin subdomain URL for redirects.
 */
function getAdminSubdomainUrl(hostname: string): string {
  const hostnameWithoutPort = hostname.split(':')[0];
  const port = hostname.includes(':') ? hostname.split(':')[1] : '';
  
  // Local development
  if (hostnameWithoutPort === 'localhost' || hostnameWithoutPort.endsWith('.localhost')) {
    return `http://admin.localhost:${port || '3001'}`;
  }
  
  // Dev
  if (hostnameWithoutPort.endsWith('.pillar.bot') || hostnameWithoutPort === 'pillar.bot') {
    return 'https://admin.pillar.bot';
  }
  
  // Production
  if (hostnameWithoutPort.endsWith('.trypillar.com') || hostnameWithoutPort === 'trypillar.com') {
    return 'https://admin.trypillar.com';
  }
  
  return '/';
}

export function middleware(request: NextRequest) {
  const startTime = performance.now();
  const hostname = request.headers.get('host') || 'localhost:3001';
  const pathname = request.nextUrl.pathname;
  const locale = getLocaleFromRequest(request);

  debugMiddleware(`${request.method} ${pathname}`, { hostname });

  // Determine the type of request
  const isAdmin = isAdminSubdomain(hostname);
  const isMarketing = isRootDomain(hostname);
  
  debugMiddleware('Request context', { isAdmin, isMarketing });

  // REDIRECT: If someone tries to access /admin on any subdomain,
  // redirect them to the admin subdomain
  if (!isAdmin && pathname.startsWith('/admin')) {
    const adminUrl = getAdminSubdomainUrl(hostname);
    return NextResponse.redirect(`${adminUrl}/knowledge`);
  }

  // REDIRECT: If someone accesses /admin/... on the admin subdomain,
  // redirect to the equivalent path without /admin prefix
  if (isAdmin && pathname.startsWith('/admin')) {
    const newPath = pathname.replace(/^\/admin/, '') || '/knowledge';
    return NextResponse.redirect(`${getAdminSubdomainUrl(hostname)}${newPath}`);
  }

  // REDIRECT: If someone tries to access /login, /signup, /signup-beta, /onboarding on root domain,
  // redirect them to the admin subdomain
  if (isMarketing && (
    pathname.startsWith('/login') || 
    pathname.startsWith('/signup') || 
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/logout')
  )) {
    const adminUrl = getAdminSubdomainUrl(hostname);
    return NextResponse.redirect(`${adminUrl}${pathname}${request.nextUrl.search}`);
  }

  // REWRITE: Marketing pages to internal /marketing routes
  // This avoids route conflicts with public help center routes
  // Note: Cannot use _ prefix as Next.js treats those as private folders
  // Safe because customer subdomains have isMarketing=false, so no collision with "marketing" category
  if (isMarketing && !pathname.startsWith('/marketing')) {
    // Marketing paths: /, /assistant, /demos/*
    if (pathname === '/' || pathname === '/assistant' || pathname.startsWith('/demos')) {
      const newUrl = request.nextUrl.clone();
      newUrl.pathname = `/marketing${pathname === '/' ? '' : pathname}`;
      debugMiddleware(`Rewriting marketing path ${pathname} to ${newUrl.pathname}`);
      
      // IMPORTANT: Must set headers on the rewrite response, otherwise the
      // layout won't know this is a marketing request
      const rewriteHeaders = new Headers(request.headers);
      rewriteHeaders.set('x-is-marketing', 'true');
      rewriteHeaders.set('x-is-admin', 'false');
      rewriteHeaders.set('x-is-demo', 'false');
      rewriteHeaders.set('x-customer-id', '');
      rewriteHeaders.set('x-locale', locale);
      rewriteHeaders.set('x-hostname', hostname);
      rewriteHeaders.set('x-persona-slug', '');
      
      const rewriteResponse = NextResponse.rewrite(newUrl, {
        request: {
          headers: rewriteHeaders,
        },
      });

      // Cache marketing HTML/RSC briefly at the edge.
      rewriteResponse.headers.set('Cache-Control', MARKETING_EDGE_CACHE_CONTROL);
      return rewriteResponse;
    }
  }

  // Clone the request headers
  const requestHeaders = new Headers(request.headers);

  // Inject context into headers
  requestHeaders.set('x-locale', locale);
  requestHeaders.set('x-hostname', hostname);
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('x-is-admin', isAdmin ? 'true' : 'false');
  requestHeaders.set('x-is-marketing', isMarketing ? 'true' : 'false');
  
  // Create response with updated headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // Also set headers on response for client-side access
  response.headers.set('x-locale', locale);
  response.headers.set('x-pathname', pathname);
  response.headers.set('x-is-admin', isAdmin ? 'true' : 'false');
  response.headers.set('x-is-marketing', isMarketing ? 'true' : 'false');

  // Apply short edge cache to direct /marketing requests too.
  if (isMarketing && pathname.startsWith('/marketing')) {
    response.headers.set('Cache-Control', MARKETING_EDGE_CACHE_CONTROL);
  }

  const duration = performance.now() - startTime;
  debugMiddleware(`Completed in ${duration.toFixed(1)}ms`);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt, llms.txt (metadata files)
     * - Static files (images, fonts, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|llms\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
