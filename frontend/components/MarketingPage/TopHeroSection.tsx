import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/**
 * TopHeroSection - Main hero with "Your App's Copilot" heading
 * and a prominent "Get Started" CTA
 */
export function TopHeroSection() {
  return (
    <section className="group max-w-marketingSection mx-auto border-x border-marketing bg-[#2A2A2A] relative h-[500px] md:h-[688px] overflow-hidden">
      <Image
        src="/marketing/pillar-sky-v2.webp"
        alt="Pillar Sky Background"
        fill
        priority
        unoptimized
        sizes="100vw"
        className="object-cover object-[15%_center] md:object-center z-0 transition-all duration-200 ease-out group-hover:scale-[1.025]"
      />
      {/* Hero Header */}
      <div className="relative z-10 flex flex-col h-full">
        <div className="pt-8 md:pt-[180px] pb-8 md:pb-10 px-4 md:px-6 lg:px-8">
          <h1 className="font-editorial text-3xl md:text-5xl lg:text-[5.25rem] text-center text-white tracking-tight">
            Your App&apos;s Copilot
          </h1>
          <p className="text-center text-base sm:text-lg md:text-[1.375rem] text-white mt-2 max-w-3xl mx-auto px-4 md:px-0">
            Pillar is an{" "}
            <a
              href="https://github.com/pillarhq/pillar"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/40 underline-offset-2 hover:decoration-white/80 transition-all duration-200"
            >
              open source
            </a>{" "}
            copilot that turns user requests into completed actions, right
            inside your app.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 pb-8 md:pb-12 px-4">
          <Link
            href="/signup"
            className="group/btn inline-flex items-center justify-center rounded-lg bg-[#FF6E00] hover:bg-[#E06200] text-white px-8 py-3 text-base font-medium transition-colors whitespace-nowrap"
          >
            <span className="translate-x-[11px] group-hover/btn:translate-x-0 transition-transform duration-200 ease-out">
              Get Started
            </span>
            <ArrowRight className="w-4 h-4 ml-1.5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 ease-out" />
          </Link>
        </div>
      </div>
    </section>
  );
}
