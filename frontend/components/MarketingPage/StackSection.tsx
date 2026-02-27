"use client";

import { GridBackground } from "./GridBackground";
import { NumberedHeading } from "./NumberedHeading";

export function StackSection() {
  return (
    <div>
      {/* Separator line above section */}
      <div className="relative">
        <div
          className="h-[1px] w-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
        <div className="max-w-marketingSection mx-auto bg-white h-10 border-x border-marketing relative" />
        <div
          className="h-[1px] w-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
      </div>

      <section className="max-w-marketingSection mx-auto border-x bg-white">
        <div className="flex justify-center">
          <NumberedHeading className="bg-[#1A1A1A] text-[#FF6E00]">
            [02] ONE PLATFORM
          </NumberedHeading>
        </div>

        <div className="pt-16 md:pt-[140px] pb-13 relative">
          <GridBackground
            className="w-full h-full absolute top-0 left-0 z-0"
            gradients={[
              {
                x: "50%",
                y: "0%",
                radius: "70%",
                color: "white",
              },
            ]}
          />

          <div className="max-w-[1050px] mx-auto relative z-10">
            {/* Heading */}
            <div className="text-center px-4 md:px-9 pb-8 md:pb-12">
              <h2 className="font-editorial text-3xl md:text-5xl lg:text-[4.75rem] lg:leading-[1.05]">
                The Copilot Stack,{" "}
                <span className="underline decoration-[#FF6E00] decoration-[3px] underline-offset-[6px]">
                  Already Built
                </span>
              </h2>
              <p className="text-base sm:text-lg md:text-xl max-w-3xl mx-auto mt-4 md:mt-6">
                Ask any LLM how to add a copilot to your app. It&apos;ll say
                three tools. We ship one.
              </p>
            </div>

            {/* Video */}
            <div className="relative px-4 md:px-8 pb-8">
              <div className="max-w-[880px] mx-auto rounded-[8px] overflow-hidden border border-marketing shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-auto block"
                  src="/marketing/StackMerge.mp4"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Separator line below section */}
      <div className="relative">
        <div
          className="h-[1px] w-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
        <div className="max-w-marketingSection mx-auto bg-white h-10 border-x border-marketing relative" />
        <div
          className="h-[1px] w-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
      </div>
    </div>
  );
}
