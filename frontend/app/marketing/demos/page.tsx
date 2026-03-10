import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";

export const metadata: Metadata = {
  title: "Demos | Pillar",
  description:
    "Watch Pillar demos across banking, CRM, analytics, and more. Each demo shows how Pillar turns a plain-language request into completed actions.",
  alternates: {
    canonical: "/demos",
  },
  openGraph: {
    title: "Demos | Pillar",
    description:
      "Watch Pillar demos across banking, CRM, analytics, and more. Each demo shows how Pillar turns a plain-language request into completed actions.",
    url: "https://trypillar.com/demos",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const demos = [
  {
    slug: "banking",
    title: "Banking",
    prompt: "Send $200 to my cleaner",
    description: "Find payee, set amount/date, preview, and submit.",
  },
  {
    slug: "crm",
    title: "CRM (Salesforce)",
    prompt: "Close the Walmart deal as won in Salesforce and notify implementation",
    description:
      "Find the opportunity, update stage, and kick off an implementation handoff.",
  },
  {
    slug: "analytics",
    title: "Analytics (Amplitude)",
    prompt: "Add a weekly signups chart to my Amplitude dashboard",
    description: "Create a chart and add it to a dashboard.",
  },
  {
    slug: "pm",
    title: "Project Management (Linear)",
    prompt: "Create a P1 bug in Linear for the checkout crash and add it to this sprint",
    description: "Open issue form, fill fields, and add it to the cycle.",
  },
  {
    slug: "hr",
    title: "HR/People (Rippling)",
    prompt: "How do I change my direct deposit in Rippling?",
    description: "Navigate to payroll settings and open the edit flow.",
  },
  {
    slug: "grafana",
    title: "Grafana Copilot (Interactive)",
    prompt: "Try a live, interactive demo",
    description: "An iframe demo with a writeup and guided prompts.",
  },
  {
    slug: "superset",
    title: "Superset Copilot (Interactive)",
    prompt: "Try a live, interactive demo",
    description:
      "Explore dashboards, create charts, and query data with the Pillar AI assistant inside Apache Superset.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-[#F3EFE8] flex flex-col">
      <MarketingNavbar />

      <section className="pt-12 pb-8 lg:pt-16 lg:pb-12">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1A1A1A] text-center leading-tight mb-4">
            Demos
          </h1>
          <p className="text-lg text-[#6B6B6B] text-center max-w-3xl mx-auto">
            Short demos that show how Pillar turns a plain-language request into
            completed actions.
          </p>
        </div>
      </section>

      <section className="pb-12">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {demos.map((demo) => (
              <Link
                key={demo.slug}
                href={`/demos/${demo.slug}`}
                className="bg-white rounded-xl p-6 border border-[#E5E0D8] hover:border-[#1A1A1A] transition-colors"
              >
                <h2 className="font-semibold text-[#1A1A1A] text-lg mb-2">
                  {demo.title}
                </h2>
                <p className="text-sm text-[#6B6B6B] mb-3">&ldquo;{demo.prompt}&rdquo;</p>
                <p className="text-sm text-[#6B6B6B]">{demo.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

