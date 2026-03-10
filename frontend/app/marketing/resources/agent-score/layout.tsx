import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Readiness Score | Pillar",
  description:
    "Free tool that scores any website's readiness for AI agents. Checks 25+ factors across discovery, readability, interactability, permissions, and accessibility.",
  alternates: {
    canonical: "/resources/agent-score",
  },
  openGraph: {
    title: "Agent Readiness Score | Pillar",
    description:
      "Free tool that scores any website's readiness for AI agents. Checks 25+ factors across discovery, readability, interactability, permissions, and accessibility.",
    url: "https://trypillar.com/resources/agent-score",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Agent Readiness Score",
  description:
    "Free tool that scores any website's readiness for AI agents. Checks 25+ factors across discovery, readability, interactability, permissions, and accessibility.",
  url: "https://trypillar.com/resources/agent-score",
  applicationCategory: "DeveloperApplication",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  publisher: {
    "@type": "Organization",
    name: "Pillar",
    url: "https://trypillar.com",
  },
};

export default function AgentScoreLayout({
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

      <main className="flex-1 max-w-marketingSection mx-auto border-x border-marketing bg-white w-full">
        <div className="px-6 sm:px-10 lg:px-16 pb-12 sm:pb-16">{children}</div>
      </main>

      <MarketingFooter />
    </div>
  );
}
