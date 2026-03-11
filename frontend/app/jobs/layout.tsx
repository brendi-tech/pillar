import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jobs | Pillar",
  description:
    "We're a small team and not actively hiring, but we notice people who build with Pillar. Show us what you've made.",
  alternates: {
    canonical: "/jobs",
  },
  openGraph: {
    title: "Jobs | Pillar",
    description:
      "We're a small team and not actively hiring, but we notice people who build with Pillar. Show us what you've made.",
    url: "https://trypillar.com/jobs",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Jobs",
  description:
    "We're a small team and not actively hiring, but we notice people who build with Pillar. Show us what you've made.",
  url: "https://trypillar.com/jobs",
  publisher: {
    "@type": "Organization",
    name: "Pillar",
    url: "https://trypillar.com",
  },
};

export default function JobsLayout({
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
