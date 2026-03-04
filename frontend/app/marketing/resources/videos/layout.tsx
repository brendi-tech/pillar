import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Videos | Pillar",
  description:
    "Demos, tutorials, and deep dives on building AI copilots with Pillar. See how Pillar works inside real products.",
  openGraph: {
    title: "Videos | Pillar",
    description:
      "Demos, tutorials, and deep dives on building AI copilots with Pillar.",
    url: "https://trypillar.com/resources/videos",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: "https://trypillar.com/resources/videos",
  },
};

export default function VideosLayout({
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
        <div className="px-6 sm:px-10 lg:px-16 py-12 sm:py-16">
          {children}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
