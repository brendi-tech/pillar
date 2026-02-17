import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Readiness Score | Pillar",
  description:
    "Free tool that scores any website's readiness for AI agents. Checks 25+ factors across discovery, readability, interactability, permissions, and accessibility.",
  openGraph: {
    title: "Agent Readiness Score | Pillar",
    description:
      "Free tool that scores any website's readiness for AI agents. Checks 25+ factors across discovery, readability, interactability, permissions, and accessibility.",
    url: "https://trypillar.com/tools/agent-score",
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
      <MarketingNavbar />

      <main className="flex-1 max-w-marketingSection mx-auto border-x border-marketing bg-white w-full">
        <div className="px-6 sm:px-10 lg:px-16 pb-12 sm:pb-16">{children}</div>
      </main>

      <MarketingFooter />
    </div>
  );
}
