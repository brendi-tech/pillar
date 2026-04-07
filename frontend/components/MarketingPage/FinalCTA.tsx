"use client";

import Link from "next/link";
import { GridBackground } from "./GridBackground";

/**
 * FinalCTA - Final call-to-action section
 *
 * Features a centered message box with editorial typography
 * and a prominent signup button.
 */
export function FinalCTA() {
  return (
    <div className="relative">
      <section className="max-w-marketingSection mx-auto border-x border-marketing bg-white py-16 md:py-24 relative">
        <GridBackground
          className="w-full h-full absolute top-0 left-0"
          gradients={[
            {
              x: "50%",
              y: "100%",
              radius: "35%",
              color: "white",
            },
            {
              x: "50%",
              y: "0%",
              radius: "40%",
              color: "white",
            },
          ]}
        />
        <div className="max-w-[1026px] mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Message Box */}
          <div className="bg-[#F3EFE8] border px-8 py-12 border-[#E5E0D8] text-center">
            <h2 className="font-editorial text-2xl md:text-4xl lg:text-[3.875rem] lg:leading-[62px] text-[#1A1A1A] mb-6">
              Your tools exist. Pillar is the{" "}
              <span className="underline decoration-3 underline-offset-4">
                platform
              </span>{" "}
              that makes them useful.
            </h2>
            <p className="text-[#1A1A1A] text-base sm:text-lg md:text-xl">
              Connect your tools, configure your agents, manage
              conversations — one dashboard for every channel.
            </p>
          </div>

          {/* CTA Button */}
          <div className="flex justify-center mt-8">
            <Link
              href="/signup"
              className="bg-[#FF6E00] hover:bg-[#E56200] text-white font-medium py-3 px-8 rounded-md transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>
      <div
        className="h-[1px] w-full"
        style={{
          background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
        }}
      />
    </div>
  );
}
