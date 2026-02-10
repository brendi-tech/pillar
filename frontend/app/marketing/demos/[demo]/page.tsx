import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import { DemoVideo } from "./DemoVideo";

type DemoSlug = "banking" | "crm" | "analytics" | "pm" | "hr";

const VIDEO_DEMOS: Record<
  DemoSlug,
  {
    title: string;
    prompt: string;
    description: string;
    mp4: string;
    webm: string;
  }
> = {
  banking: {
    title: "Banking demo",
    prompt: "Send $200 to my cleaner",
    description: "Find payee, set amount/date, preview, and submit.",
    mp4: "/marketing/BankingDemo.mp4",
    webm: "/marketing/BankingDemo.webm",
  },
  crm: {
    title: "CRM demo (Salesforce)",
    prompt: "Close the Walmart deal as won in Salesforce and notify implementation",
    description:
      "Find the opportunity, update stage, and kick off an implementation handoff.",
    mp4: "/marketing/CRMDemo.mp4",
    webm: "/marketing/CRMDemo.webm",
  },
  analytics: {
    title: "Analytics demo (Amplitude)",
    prompt: "Add a weekly signups chart to my Amplitude dashboard",
    description: "Create a chart and add it to a dashboard.",
    mp4: "/marketing/AnalyticsDemo.mp4",
    webm: "/marketing/AnalyticsDemo.webm",
  },
  pm: {
    title: "Project management demo (Linear)",
    prompt: "Create a P1 bug in Linear for the checkout crash and add it to this sprint",
    description: "Open issue form, fill fields, and add it to the cycle.",
    mp4: "/marketing/PMDemo.mp4",
    webm: "/marketing/PMDemo.webm",
  },
  hr: {
    title: "HR/People demo (Rippling)",
    prompt: "How do I change my direct deposit in Rippling?",
    description: "Navigate to payroll settings and open the edit flow.",
    mp4: "/marketing/HRDemo.mp4",
    webm: "/marketing/HRDemo.webm",
  },
};

export async function generateStaticParams(): Promise<{ demo: DemoSlug }[]> {
  return Object.keys(VIDEO_DEMOS).map((demo) => ({ demo: demo as DemoSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ demo: string }>;
}): Promise<Metadata> {
  const { demo } = await params;
  if (!(demo in VIDEO_DEMOS)) return {};

  const data = VIDEO_DEMOS[demo as DemoSlug];
  const title = `${data.title} | Pillar`;
  const description = `“${data.prompt}” — ${data.description}`;
  const canonical = `/demos/${demo}`;

  return {
    title,
    description,
    metadataBase: new URL("https://trypillar.com"),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `https://trypillar.com${canonical}`,
      siteName: "Pillar",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ demo: string }>;
}) {
  const { demo } = await params;
  if (!(demo in VIDEO_DEMOS)) notFound();

  const data = VIDEO_DEMOS[demo as DemoSlug];

  return (
    <div className="min-h-screen bg-[#F3EFE8] flex flex-col">
      <MarketingNavbar />

      <section className="pt-10 pb-6 lg:pt-14">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Link
              href="/demos"
              className="text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
            >
              ← All demos
            </Link>
            <div className="flex items-center gap-3">
              <a
                href={data.mp4}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
              >
                MP4
              </a>
              <a
                href={data.webm}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
              >
                WebM
              </a>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1A1A1A] leading-tight mt-4">
            {data.title}
          </h1>
          <p className="text-lg text-[#6B6B6B] mt-3">&ldquo;{data.prompt}&rdquo;</p>
          <p className="text-sm text-[#6B6B6B] mt-2">{data.description}</p>
        </div>
      </section>

      <section className="pb-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#1A1A1A] shadow-2xl">
            <DemoVideo mp4={data.mp4} />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

