"use client";

import { cn } from "@/lib/utils";
import { ArrowRight, Check } from "lucide-react";
import { NumberedHeading } from "./NumberedHeading";

interface PricingTier {
  name: string;
  badge: { text: string; bg: string; color: string };
  description: string;
  price: string;
  priceSubtext?: string;
  responseLimit: string;
  ctaText: string;
  ctaSubtext: string;
  features: string[];
  highlighted?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: "free",
    badge: { text: "FREE", bg: "rgba(11, 35, 142, 0.32)", color: "#95B7FF" },
    description: "Try Pillar risk-free",
    price: "$0",
    responseLimit: "50 responses",
    ctaText: "Join Waitlist",
    ctaSubtext: "One-time, no card required",
    features: [
      "Actions (execute, pre-fill)",
      "Analytics dashboard",
      "Widget customization",
    ],
  },
  {
    name: "hobby",
    badge: { text: "HOBBY", bg: "rgba(11, 142, 64, 0.32)", color: "#4EE479" },
    description: "For side projects",
    price: "$19",
    priceSubtext: "per month",
    responseLimit: "100 responses/mo",
    ctaText: "Join Waitlist",
    ctaSubtext: "Then $0.25/response",
    features: [
      "Actions (execute, pre-fill)",
      "Analytics dashboard",
      "Widget customization",
    ],
  },
  {
    name: "pro",
    badge: { text: "PRO", bg: "#954509", color: "#FF6E00" },
    description: "For production apps",
    price: "$99",
    priceSubtext: "per month",
    responseLimit: "400 responses/mo",
    ctaText: "Join Waitlist",
    ctaSubtext: "Then $0.20/response",
    highlighted: true,
    features: [
      "Everything in Hobby",
      "Priority support",
    ],
  },
  {
    name: "growth",
    badge: { text: "GROWTH", bg: "rgba(142, 11, 84, 0.32)", color: "#FF78CB" },
    description: "For scaling apps",
    price: "$249",
    priceSubtext: "per month",
    responseLimit: "1,500 responses/mo",
    ctaText: "Join Waitlist",
    ctaSubtext: "Then $0.15/response",
    features: [
      "Everything in Pro",
      "Custom integrations",
    ],
  },
];

/**
 * PricingSection - Usage-based pricing display with 4 tiers
 *
 * Features responsive grid layout, highlighted PRO tier,
 * and decorative dashed dividers between cards.
 */
interface PricingSectionProps {
  onOpenWaitlist?: () => void;
  /** Hide the "[05] PRICING" numbered heading (used on standalone pricing page) */
  hideNumberedHeading?: boolean;
}

export function PricingSection({ onOpenWaitlist, hideNumberedHeading }: PricingSectionProps) {
  return (
    <div className="relative">
      {/* Gradient line outside, solid blue inside container */}
      <div className="absolute top-0 left-0 right-0 h-[1px] z-10 max-w-marketingSection mx-auto" style={{ background: "#000622" }} />
      <div className="absolute top-0 left-0 h-[1px] z-10" style={{ width: "calc((100% - 1334px) / 2)", background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 60%, #D4D4D4 100%)" }} />
      <div className="absolute top-0 right-0 h-[1px] z-10" style={{ width: "calc((100% - 1334px) / 2)", background: "linear-gradient(90deg, #D4D4D4 0%, #D4D4D4 40%, rgba(212,212,212,0) 100%)" }} />
      <section className="bg-[#000622] py-16 md:py-24 max-w-marketingSection mx-auto border-x border-marketing relative">
        {!hideNumberedHeading && (
          <NumberedHeading className="bg-[#0F253D] text-[#58A6FF] absolute top-0 lg:left-[64px] left-1/2 -translate-x-1/2 lg:translate-x-0 z-10">
            [05] PRICING
          </NumberedHeading>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12 md:mb-16">
            <h2 className="font-editorial text-4xl md:text-[3.875rem] lg:leading-[62px] text-white mb-4">
              Usage-Based{" "}
              <span className="underline decoration-2 underline-offset-4">
                Pricing
              </span>
            </h2>
            <p className="text-white text-lg">
              Pay for what you use. Start free, scale as you grow.
            </p>
            <p className="text-white/50 text-sm mt-2">
              Only substantive AI responses count — greetings and simple acknowledgments are free.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
            {pricingTiers.map((tier, index) => (
              <div key={tier.name} className="relative flex">
                {/* Dashed divider - between all cards, skip around highlighted (Pro) section */}
                {index !== 2 && index !== 3 && (
                  <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px">
                    <div 
                      className="absolute inset-0"
                      style={{
                        backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.3) 50%, transparent 50%)",
                        backgroundSize: "1px 8px",
                        maskImage: "linear-gradient(to bottom, transparent 0%, white 50%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, white 50%, transparent 100%)"
                      }}
                    />
                  </div>
                )}
                {/* Right side dashed divider for last card */}
                {index === 3 && (
                  <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-px">
                    <div 
                      className="absolute inset-0"
                      style={{
                        backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.3) 50%, transparent 50%)",
                        backgroundSize: "1px 8px",
                        maskImage: "linear-gradient(to bottom, transparent 0%, white 50%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, white 50%, transparent 100%)"
                      }}
                    />
                  </div>
                )}

                {/* Card */}
                <div
                  className={cn(
                    "flex-1 p-6 md:p-8 flex flex-col",
                    tier.highlighted
                      ? "bg-[#FF6E00] border-2 border-[#FF6E00] overflow-hidden"
                      : "bg-transparent"
                  )}
                >
                  {/* Badge */}
                  <div
                    className="inline-flex w-fit px-2 py-1 text-xs font-mono tracking-wider mb-3"
                    style={{
                      backgroundColor: tier.badge.bg,
                      color: tier.badge.color,
                    }}
                  >
                    {tier.badge.text}
                  </div>

                  {/* Description */}
                  <p
                    className={cn(
                      "text-sm mb-6",
                      tier.highlighted ? "text-white" : "text-white/70"
                    )}
                  >
                    {tier.description}
                  </p>

                  {/* Price */}
                  <div className="mb-1">
                    <span
                      className={cn(
                        "text-4xl md:text-[2.625rem]  font-editorial",
                        tier.highlighted ? "text-white" : "text-white"
                      )}
                    >
                      {tier.price}
                    </span>
                    {tier.priceSubtext && (
                      <span
                        className={cn(
                          "text-sm ml-2",
                          tier.highlighted ? "text-white/80" : "text-white/50"
                        )}
                      >
                        {tier.priceSubtext}
                      </span>
                    )}
                  </div>

                  {/* Response limit */}
                  <p
                    className={cn(
                      "text-sm mb-6",
                      tier.highlighted ? "text-white" : "text-white/70"
                    )}
                  >
                    {tier.responseLimit}
                  </p>

                  {/* CTA Button */}
                  <button
                    onClick={onOpenWaitlist}
                    className={cn(
                      "group relative w-full py-3 px-4 text-sm font-medium transition-colors mb-2 rounded-[6px] text-center",
                      tier.highlighted
                        ? "bg-white text-[#1A1A1A] hover:bg-[#000622] hover:text-white"
                        : "bg-transparent border border-white/30 text-white hover:bg-white hover:text-[#000622] hover:border-white"
                    )}
                  >
                    {tier.ctaText}
                    <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </button>

                  {/* CTA Subtext */}
                  <p
                    className={cn(
                      "text-[10px] font-mono tracking-wider text-center mb-4",
                      tier.highlighted ? "text-white/70" : "text-white/40"
                    )}
                  >
                    {tier.ctaSubtext}
                  </p>

                  {/* Features List */}
                  <div
                    className={cn(
                      "pt-4 mt-2 space-y-3",
                      tier.highlighted
                        ? "border-t border-white/20"
                        : "border-t border-white/10"
                    )}
                  >
                    {tier.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3">
                        <Check
                          className={cn(
                            "w-4 h-4 flex-shrink-0",
                            tier.highlighted ? "text-white" : "text-[#4EE479]"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            tier.highlighted ? "text-white/90" : "text-white/70"
                          )}
                        >
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Enterprise CTA */}
          <div className="mt-12 text-center">
            <p className="text-white/70 text-lg">
              Need enterprise features like SSO, SLA, or custom integrations?{" "}
              <button
                onClick={onOpenWaitlist}
                className="text-[#C084FC] hover:text-[#D8B4FE] underline underline-offset-4 transition-colors"
              >
                Contact us for enterprise pricing
              </button>
            </p>
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
