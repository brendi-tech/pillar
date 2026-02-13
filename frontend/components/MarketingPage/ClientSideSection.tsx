"use client";

import ClientSideFeatures from "./ClientSideFeatures";
import { GridBackground } from "./GridBackground";
import { NumberedHeading } from "./NumberedHeading";

const CYCLE_DURATION = 6000;

const features = [
  {
    number: "01",
    title: "Same Session",
    subtitle: "Real Power",
    description:
      "Pillar runs in the user's browser with their session—and registers actions as WebMCP tools. No proxy servers, no token forwarding. When navigator.modelContext ships, your app is already wired.",
  },
  {
    number: "02",
    title: "Full Control",
    subtitle: "Your Code",
    description:
      "Your actions are client defined. Re-use patterns, forms, and CSS that already exist. Inline in chat or directly as modals.",
  },
  {
    number: "03",
    title: "Native Speed",
    subtitle: "Zero Latency",
    description:
      "UI actions happen locally, instantly. No round-trip to external servers. Feels native because it is native.",
  },
  {
    number: "04",
    title: "Your Infrastructure",
    subtitle: "You Orchestrate",
    description:
      "Actions call your APIs with the user's existing auth. You control what's possible. Pillar just orchestrates.",
  },
];

export const ClientSideSection = () => {
  return (
    <div>
      <section className=" border-x border-marketing max-w-marketingSection mx-auto bg-white">
        <div className="flex justify-center">
          <NumberedHeading className="bg-[#14314B] text-[#00CCFF]">
            [03] SAFE BY DESIGN
          </NumberedHeading>
        </div>
        <div className="pt-8 pb-12">
<h2 className="font-editorial text-3xl md:text-5xl lg:text-[3.875rem] lg:leading-[62px] text-center">
            Why Client-Side actually works
          </h2>
          <p className="text-center text-base sm:text-lg md:text-xl max-w-4xl mx-auto px-4 md:px-0 mt-4">
            AI assistants today can only chat. Pillar can act—because it runs
            where your users do.
          </p>
        </div>
        <ClientSideFeatures />
      </section>
      <div className="relative">
        <div
          className="h-[1px] w-full"
          style={{
            background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
        <div className="relative max-w-marketingSection mx-auto bg-white h-[71px] border-x border-marketing">
          <GridBackground
            className="w-full h-full absolute top-0 left-0"
            gradients={[
              {
                x: "50%",
                y: "30%",
                radius: "45%",
                color: "white",
              },
            ]}
          />
        </div>
        <div
          className="h-[1px] w-full"
          style={{
            background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
      </div>
    </div>
  );
};
