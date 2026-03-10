"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { NumberedHeading } from "./NumberedHeading";
import { PLAN_TIERS, getTierForInterval } from "@/lib/billing/plans";
import type { BillingInterval, PlanTier } from "@/lib/billing/plans";
import { BillingIntervalToggle } from "@/components/BillingIntervalToggle";

/**
 * PricingSection - Usage-based pricing display with 4 tiers
 *
 * Features responsive grid layout, highlighted PRO tier,
 * monthly/yearly toggle, and decorative dashed dividers between cards.
 */
interface PricingSectionProps {
  /** Hide the "[05] PRICING" numbered heading (used on standalone pricing page) */
  hideNumberedHeading?: boolean;
  /** Currently active plan name - highlights that card for signed-in users */
  activePlan?: string;
}

export function PricingSection({ hideNumberedHeading, activePlan }: PricingSectionProps) {
  const [interval, setInterval] = useState<BillingInterval>("yearly");

  return (
    <div className="relative">
      {/* Gradient line outside, solid blue inside container */}
      <div className="absolute top-0 left-0 right-0 h-[1px] z-10 max-w-marketingSection mx-auto" style={{ background: "#000622" }} />
      <div className="absolute top-0 left-0 h-[1px] z-10" style={{ width: "calc((100% - 1334px) / 2)", background: "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 60%, #D4D4D4 100%)" }} />
      <div className="absolute top-0 right-0 h-[1px] z-10" style={{ width: "calc((100% - 1334px) / 2)", background: "linear-gradient(90deg, #D4D4D4 0%, #D4D4D4 40%, rgba(212,212,212,0) 100%)" }} />
      <section className="bg-[#000622] py-16 md:py-24 max-w-marketingSection mx-auto border-x border-marketing relative">
        {!hideNumberedHeading && (
          <NumberedHeading className="bg-[#0F253D] text-[#58A6FF] absolute top-0 lg:left-[64px] left-1/2 -translate-x-1/2 lg:translate-x-0 z-10">
            [06] PRICING
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-white text-lg">
                  Pay for what you use. Start free, scale as you grow.
                </p>
                <p className="text-white/50 text-sm mt-2">
                  Only substantive AI responses count — greetings and simple acknowledgments are free.
                </p>
              </div>
              <BillingIntervalToggle
                interval={interval}
                onChange={setInterval}
                variant="dark"
              />
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
            {PLAN_TIERS.map((rawTier, index) => {
              const tier = getTierForInterval(rawTier, interval);
              const isYearly = interval === "yearly" && !!rawTier.yearly;
              const isCurrent = activePlan === tier.name;
              const isHighlighted = isCurrent || (tier.highlighted && !activePlan);

              return (
                <div key={tier.name} className="relative flex">
                  {/* Dashed divider - between all cards, skip around highlighted section */}
                  {!isHighlighted && !(index > 0 && (activePlan === PLAN_TIERS[index - 1]?.name || (!activePlan && PLAN_TIERS[index - 1]?.highlighted))) && index !== 0 && (
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
                  {/* Right side dashed divider for last non-highlighted card */}
                  {index === 3 && !isHighlighted && (
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
                      isHighlighted
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
                        isHighlighted ? "text-white" : "text-white/70"
                      )}
                    >
                      {tier.description}
                    </p>

                    {/* Price */}
                    <div className="mb-1">
                      <span
                        className={cn(
                          "text-4xl md:text-[2.625rem] font-editorial",
                          "text-white"
                        )}
                      >
                        {tier.priceLabel}
                      </span>
                      {tier.priceSubtext && (
                        <span
                          className={cn(
                            "text-sm ml-2",
                            isHighlighted ? "text-white/80" : "text-white/50"
                          )}
                        >
                          {tier.priceSubtext}
                        </span>
                      )}
                    </div>

                    {/* Response limit */}
                    <p
                      className={cn(
                        "text-sm",
                        isHighlighted ? "text-white" : "text-white/70"
                      )}
                    >
                      {tier.responseLimit}
                      {isYearly && (
                        <span
                          className={cn(
                            "ml-1 text-xs",
                            isHighlighted ? "text-white/60" : "text-white/40"
                          )}
                        >
                          · billed yearly
                        </span>
                      )}
                    </p>
                    <div className="mb-6 mt-0.5" />

                    {/* CTA Button */}
                    {isCurrent ? (
                      <div
                        className="w-full py-3 px-4 text-sm font-medium mb-2 rounded-[6px] text-center bg-white text-[#FF6E00]"
                      >
                        Current Plan
                      </div>
                    ) : (
                      <Link
                        href={activePlan ? "/billing" : "/signup"}
                        className={cn(
                          "group relative w-full py-3 px-4 text-sm font-medium transition-colors mb-2 rounded-[6px] text-center",
                          isHighlighted
                            ? "bg-white text-[#1A1A1A] hover:bg-[#000622] hover:text-white"
                            : "bg-transparent border border-white/30 text-white hover:bg-white hover:text-[#000622] hover:border-white"
                        )}
                      >
                        {tier.ctaText}
                        <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                      </Link>
                    )}

                    {/* CTA Subtext */}
                    {!isCurrent && (
                      <p
                        className={cn(
                          "text-[10px] font-mono tracking-wider text-center mb-4",
                          isHighlighted ? "text-white/70" : "text-white/40"
                        )}
                      >
                        {tier.ctaSubtext}
                      </p>
                    )}
                    {isCurrent && <div className="mb-4" />}

                    {/* Features List */}
                    <div
                      className={cn(
                        "pt-4 mt-2 space-y-3",
                        isHighlighted
                          ? "border-t border-white/20"
                          : "border-t border-white/10"
                      )}
                    >
                      {tier.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-3">
                          <Check
                            className={cn(
                              "w-4 h-4 flex-shrink-0",
                              isHighlighted ? "text-white" : "text-[#4EE479]"
                            )}
                          />
                          <span
                            className={cn(
                              "text-sm",
                              isHighlighted ? "text-white/90" : "text-white/70"
                            )}
                          >
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enterprise CTA */}
          <div className="mt-12 text-center">
            <p className="text-white/70 text-lg">
              Need enterprise features like SSO, SLA, or custom integrations?{" "}
              <a
                href="mailto:team@trypillar.com"
                className="text-[#C084FC] hover:text-[#D8B4FE] underline underline-offset-4 transition-colors"
              >
                Contact us for enterprise pricing
              </a>
            </p>
            <p className="text-white/40 text-xs mt-4">
              Simple responses are free. Longer responses count proportionally.
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
