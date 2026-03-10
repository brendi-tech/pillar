import { MarketingNavbar } from '@/components/MarketingPage/MarketingNavbar';
import { MarketingFooter } from '@/components/MarketingPage/MarketingFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Pricing | Pillar",
  description:
    "Simple, transparent pricing for Pillar. Free tier included. Scale your AI copilot as your product grows.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Pricing | Pillar",
    description:
      "Simple, transparent pricing for Pillar. Free tier included. Scale your AI copilot as your product grows.",
    url: "https://trypillar.com/pricing",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Pricing",
  description:
    "Simple, transparent pricing for Pillar. Free tier included. Scale your AI copilot as your product grows.",
  url: "https://trypillar.com/pricing",
  publisher: {
    "@type": "Organization",
    name: "Pillar",
    url: "https://trypillar.com",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col bg-[#F3EFE8]"
      style={{
        backgroundImage: "url('/marketing/stripe-pattern.png')",
        backgroundRepeat: "repeat",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingNavbar />

      {/* Main content */}
      <main className="flex-1 max-w-marketingSection mx-auto border-x border-marketing w-full">
        {children}
      </main>

      <MarketingFooter />
    </div>
  );
}
