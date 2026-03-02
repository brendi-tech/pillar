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
