"use client";

import { ChatShowcase } from "./ChatShowcase";
import { GridBackground } from "./GridBackground";
import { LiveDemoBar } from "./LiveDemoBar";
import { NumberedHeading } from "./NumberedHeading";

/**
 * DemoSection - "See how it works in action" section
 * Features the interactive demo with vertical tabs
 */
export function DemoSection() {
  return (
    <div>
      {/* Separator line above section */}
      <div className="relative">
        <div
          className="h-[1px] w-full"
          style={{
            background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
        <div className="max-w-marketingSection mx-auto bg-white h-10 border-x border-marketing relative"></div>
        <div
          className="h-[1px] w-full"
          style={{
            background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
      </div>
      <section className="max-w-marketingSection mx-auto border-x bg-white">
        <div className="flex justify-center">
          <NumberedHeading className="text-[#1a1472] bg-[#001AFF]/15">
            [04] HOW IT WORKS
          </NumberedHeading>
        </div>
        <div className="pt-16 md:pt-[100px] pb-8 relative">
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
          <div className="relative max-w-[1300px] mx-auto">
            <div className="text-center px-4 md:px-9 pb-8 md:pb-12">
<h2 className="font-editorial text-3xl md:text-5xl lg:text-[4.75rem] lg:leading-[62px] text-[#020202]">
                See it{" "}
                <span className="underline decoration-2 underline-offset-4">
                  in action
                </span>
              </h2>
            </div>

            {/* Chat Showcase Demo */}
            <ChatShowcase />

            {/* Live demo links */}
            <LiveDemoBar />
          </div>
        </div>
      </section>
    </div>
  );
}
