import type { Metadata } from "next";
import { MarketingSDKProvider } from "@/providers/MarketingSDKProvider";

export const metadata: Metadata = {
  title: {
    template: "%s | Pillar",
    default: "Pillar - Your App's Copilot",
  },
  description:
    "Pillar is an open source copilot that turns user and agent requests into completed actions, right inside your app.",
  robots: "index, follow, max-snippet:-1, max-image-preview:large",
  openGraph: {
    siteName: "Pillar",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

/**
 * JSON-LD structured data for SEO.
 * Helps search engines understand the page content and display rich results.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Pillar",
  applicationCategory: "BusinessApplication",
  description:
    "Pillar is an open source copilot that turns user and agent requests into completed actions, right inside your app.",
  url: "https://trypillar.com",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available",
  },
  publisher: {
    "@type": "Organization",
    name: "Pillar",
    url: "https://trypillar.com",
    logo: {
      "@type": "ImageObject",
      url: "https://trypillar.com/pillar-logo.png",
    },
  },
};

/**
 * Marketing Layout
 *
 * Wraps marketing pages with Modern Archive design system CSS variables.
 * Includes JSON-LD structured data for SEO.
 * Navbar and footer are page-specific (e.g., only on /assistant).
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-page">
      {/* JSON-LD structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Modern Archive design system CSS variables */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --archive-ink: #1A1A1A;
              --archive-cream: #F3EFE8;
              --archive-sand: #E8E4DC;
              --archive-stone: #E5E0D8;
              --archive-shadow: #666666;
              --archive-amber: #FF6E00;
              --archive-rust: #B46450;
              --archive-forest: #2D5A4A;
            }
          `,
        }}
      />
      <MarketingSDKProvider>{children}</MarketingSDKProvider>
    </div>
  );
}
