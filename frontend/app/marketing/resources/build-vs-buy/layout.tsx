import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Build vs Buy Your AI Copilot — An Honest Assessment | Pillar",
  description:
    "What it takes to build a copilot yourself — a vector database, a backend agent, a frontend UI, and the glue between them. When to build, and when one SDK is enough.",
  openGraph: {
    title: "Build vs Buy Your AI Copilot — An Honest Assessment | Pillar",
    description:
      "What it takes to build a copilot yourself — a vector database, a backend agent, a frontend UI, and the glue between them. When to build, and when one SDK is enough.",
    url: "https://trypillar.com/resources/build-vs-buy",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function BuildVsBuyLayout({
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
