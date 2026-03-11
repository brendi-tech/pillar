import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Pillar",
  description:
    "Tell us what you are building with Pillar. Reach out to talk through product fit, implementation, or demos.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Us | Pillar",
    description:
      "Tell us what you are building with Pillar. Reach out to talk through product fit, implementation, or demos.",
    url: "https://trypillar.com/contact",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact Us",
  description:
    "Tell us what you are building with Pillar. Reach out to talk through product fit, implementation, or demos.",
  url: "https://trypillar.com/contact",
  publisher: {
    "@type": "Organization",
    name: "Pillar",
    url: "https://trypillar.com",
  },
};

export default function ContactLayout({
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
      <main className="flex-1 max-w-marketingSection mx-auto border-x border-marketing w-full">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
