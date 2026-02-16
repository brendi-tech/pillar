"use client";

import { cn } from "@/lib/utils";
import { Code, Layers, RefreshCw, Zap } from "lucide-react";
import { GridBackground } from "./GridBackground";
import { NumberedHeading } from "./NumberedHeading";

const features = [
  {
    icon: Zap,
    title: "One Install, MCP Included",
    description:
      "npm install and go. Ships with a standards-compliant MCP server—Claude, ChatGPT, Cursor, and any MCP client connect out of the box.",
  },
  {
    icon: Layers,
    title: "Managed Knowledge",
    description:
      "We crawl your docs and integrate with your content sources. RAG that stays fresh, automatically.",
  },
  {
    icon: Code,
    title: "Full Control",
    description:
      "Define actions in your frontend code. Same session, same auth—no token passing. Can call your backend too.",
  },
  {
    icon: RefreshCw,
    title: "Self-Improving",
    description:
      "When a user gets stuck, easily copy a prompt from Pillar to your AI coding tool to create a new action directing the model on what to do.",
  },
];

/**
 * EngineersSection - "Built for Engineers who ship" section
 * Features Editorial Today font for heading, SF Mono for tags,
 * and feature cards grid
 */
export function EngineersSection() {
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
        <div className="max-w-marketingSection mx-auto bg-white h-10 border-x border-marketing relative"></div>
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
          <NumberedHeading className="text-[#9B4534] bg-[#FF2200]/15">
            [02] BATTERIES INCLUDED
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
          <div className="max-w-[1050px] mx-auto">
            <div className="text-left px-4 md:px-9 pb-8 md:pb-20">
              <div className="relative ">
                <h2 className="font-editorial relative text-regular text-3xl md:text-5xl lg:text-[4.75rem] lg:leading-[62px] text-center text-[#020202]">
                  Built for Engineers who ship
                </h2>
                {/* Floating tags - hidden on mobile */}
                <p className="hidden lg:block font-mono text-[#FF6E00] text-xs bg-[#332429] w-fit px-2.5 py-1 absolute -top-2.5 left-[100px]">
                  TRUST
                </p>
                <p className="hidden lg:block font-mono text-[#FF6E00] text-xs bg-[#332429] w-fit px-2.5 py-1 absolute -bottom-4 left-[50px]">
                  CLEAR VISION
                </p>
                <p className="hidden lg:block font-mono text-[#FF6E00] text-xs bg-[#332429] w-fit px-2.5 py-1 absolute top-1 left-[402px]">
                  CODE
                </p>
                <p className="hidden lg:block font-mono text-[#FF6E00] text-xs bg-[#332429] w-fit px-2.5 py-1 absolute -top-2 left-[758px]">
                  IMPLEMENTATION
                </p>
              </div>
            </div>

            {/* Feature cards grid */}
            <div className="relative px-4 md:px-8 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 border border-marketing rounded-[8px] overflow-hidden max-w-[880px] mx-auto shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
                {features.map((feature, idx) => {
                  const isWhiteBg = idx === 0 || idx === 3;
                  const isLeftColumn = idx % 2 === 0;
                  const isTopRow = idx < 2;
                  const isLastCard = idx === features.length - 1;
                  return (
                    <div
                      key={feature.title}
                      className={cn(
                        " p-5 relative min-h-[160px]",
                        isWhiteBg && "bg-white",
                        isLeftColumn && "md:border-r border-marketing",
                        // Mobile: all except last get bottom border; Desktop: only top row
                        !isLastCard &&
                          "border-b md:border-b-0 border-marketing",
                        isTopRow && "md:border-b border-marketing"
                      )}
                      style={
                        !isWhiteBg
                          ? {
                              background:
                                "linear-gradient(180deg, #F3EFE8 0%, #FFF 100%)",
                            }
                          : undefined
                      }
                    >
                      <div className="flex gap-2 items-center pb-2">
                        <div
                          className={cn(
                            "size-8 flex items-center justify-center rounded-[8px]",
                            isWhiteBg ? "bg-[#F8F5F1]" : "bg-white"
                          )}
                        >
                          <feature.icon className="w-4 h-4 text-[#FF6E00]" />
                        </div>
                        <h3 className="text-base font-semibold text-[#1A1A1A]">
                          {feature.title}
                        </h3>
                      </div>

                      {/* Content */}
                      <p className=" leading-relaxed">{feature.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="relative">
        <div
          className="h-[1px] w-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)",
          }}
        />
        <div className="max-w-marketingSection mx-auto bg-white h-10 border-x border-marketing relative"></div>
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
