import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingFooter } from "@/components/MarketingPage/MarketingFooter";
import { MarketingNavbar } from "@/components/MarketingPage/MarketingNavbar";
import { DemoVideo } from "./DemoVideo";
import { VIDEO_DEMOS, type DemoSlug } from "./demos.data";

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
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `https://trypillar.com${canonical}`,
      type: "video.other",
      videos: [
        {
          url: `https://trypillar.com${data.mp4}`,
          secureUrl: `https://trypillar.com${data.mp4}`,
          type: "video/mp4",
          width: 1920,
          height: 1080,
        },
      ],
      images: [
        {
          url: `https://trypillar.com${data.thumbnail}`,
          width: 1920,
          height: 1080,
          alt: data.title,
        },
      ],
    },
    twitter: {
      card: "player",
      title,
      description,
      players: [
        {
          playerUrl: `https://trypillar.com/demos/${demo}`,
          streamUrl: `https://trypillar.com${data.mp4}`,
          width: 1920,
          height: 1080,
        },
      ],
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

  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: data.title,
    description: `"${data.prompt}" — ${data.description}`,
    thumbnailUrl: `https://trypillar.com${data.thumbnail}`,
    uploadDate: data.uploadDate,
    duration: data.durationISO,
    contentUrl: `https://trypillar.com${data.mp4}`,
    embedUrl: `https://trypillar.com/demos/${demo}`,
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

  return (
    <div className="min-h-screen bg-[#F3EFE8] flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      <MarketingNavbar />

      <section className="pt-10 pb-6 lg:pt-14">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-end gap-3">
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
            <DemoVideo mp4={data.mp4} poster={data.thumbnail} />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

