"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/** Configuration for a single live demo card. */
interface LiveDemo {
  slug: string;
  name: string;
  description: string;
  previewImage: string;
  comingSoon?: boolean;
}

/** All live demos shown in the showcase. Add new entries here. */
const liveDemos: LiveDemo[] = [
  {
    slug: "superset",
    name: "Superset",
    description: "AI copilot for Apache Superset dashboards and data exploration.",
    previewImage: "/marketing/superset-preview.webp",
  },
  {
    slug: "grafana",
    name: "Grafana",
    description: "AI copilot for Grafana monitoring, queries, and alert management.",
    previewImage: "/marketing/grafana-preview.webp",
  },
];

/**
 * LiveDemoShowcase - Card-based showcase of live interactive demos.
 * Rendered below the ChatShowcase videos in the DemoSection.
 */
export function LiveDemoBar() {
  return (
    <div className="px-4 md:px-9 pt-8 md:pt-14 pb-4">
      {/* Section heading */}
      <div className="text-center mb-8">
        <h3 className="font-editorial text-2xl md:text-3xl lg:text-4xl text-[#020202] mb-2">
          Try it live
        </h3>
        <p className="text-[#6B6B6B] text-sm md:text-base max-w-lg mx-auto">
          Explore real apps with Pillar built in. Click to open an interactive demo.
        </p>
      </div>

      {/* Demo cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
        {liveDemos.map((demo) => {
          const cardContent = (
            <>
              {/* Screenshot preview */}
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={demo.previewImage}
                  alt={`${demo.name} demo preview`}
                  fill
                  unoptimized
                  className={`object-cover object-top transition-transform duration-300 ${demo.comingSoon ? "grayscale opacity-60" : "group-hover:scale-[1.02]"}`}
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
              </div>

              {/* Card footer */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs md:text-sm font-semibold tracking-wider uppercase ${demo.comingSoon ? "text-[#1A1A1A]/50" : "text-[#1A1A1A]"}`}>
                    {demo.name}
                  </span>
                  {demo.comingSoon && (
                    <span className="text-[10px] font-medium tracking-wide uppercase bg-[#1A1A1A]/10 text-[#1A1A1A]/50 px-2 py-0.5 rounded-full">
                      Coming soon
                    </span>
                  )}
                </div>
                {!demo.comingSoon && (
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1A1A1A] text-white group-hover:bg-[#FF6E00] transition-colors">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            </>
          );

          if (demo.comingSoon) {
            return (
              <div
                key={demo.slug}
                className="block rounded-2xl bg-[#F0F5F3] border border-[#E0E8E4] overflow-hidden cursor-default"
              >
                {cardContent}
              </div>
            );
          }

          return (
            <Link
              key={demo.slug}
              href={`/demos/${demo.slug}`}
              className="group block rounded-2xl bg-[#F0F5F3] border border-[#E0E8E4] overflow-hidden hover:border-[#1A1A1A]/30 hover:shadow-lg transition-all duration-200"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
