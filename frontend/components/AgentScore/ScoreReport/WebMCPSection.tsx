"use client";

import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import { cn } from "@/lib/utils";
import type { AgentScoreReport } from "@/components/AgentScore/AgentScore.types";

interface WebMCPSectionProps {
  report: AgentScoreReport;
}

export function WebMCPSection({ report }: WebMCPSectionProps) {
  const score = report.webmcp_score;
  const webmcpChecks = report.checks.filter((c) => c.category === "webmcp");

  // Determine state
  const isNone = score === 0;
  const isFull = score >= 90;

  return (
    <div className="relative border-2 border-dashed border-[#D4D4D4] rounded-xl p-6 sm:p-8 bg-[#FAFAF8]">
      {/* Experimental badge */}
      <div className="absolute -top-3 left-5 px-3 py-0.5 text-xs font-semibold tracking-wider uppercase bg-[#F3EFE8] text-[#6B6B6B] border border-dashed border-[#D4D4D4] rounded-full">
        Experimental
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-6 mt-2">
        {/* Gauge */}
        <div className="shrink-0">
          <ScoreGauge score={score} size="sm" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-[#1A1A1A]">
            WebMCP Support
          </h3>

          {isNone && (
            <p className="text-sm text-[#6B6B6B] mt-2">
              Your site has no WebMCP tools. AI agents can see your content but
              can&apos;t take actions on your behalf. WebMCP lets you expose tools
              directly to AI agents in the browser — forms, search, navigation,
              anything your users can do.
            </p>
          )}

          {!isNone && !isFull && (
            <p className="text-sm text-[#6B6B6B] mt-2">
              Your site has partial WebMCP support. Some tools are detected but
              there&apos;s room to improve coverage and quality.
            </p>
          )}

          {isFull && (
            <p className="text-sm text-[#0CCE6B] font-medium mt-2">
              Your site is agent-ready with full WebMCP support.
            </p>
          )}
        </div>
      </div>

      {/* CTA */}
      {!isFull && (
        <Link
          href="/signup"
          className="flex items-center justify-center gap-2 w-full mt-6 h-12 px-6 text-base font-medium rounded-lg bg-[#FF6E00] hover:bg-[#E06200] text-white transition-colors"
        >
          {isNone
            ? "Add WebMCP to your site with Pillar"
            : "Improve your WebMCP score with Pillar"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {/* Check list */}
      {webmcpChecks.length > 0 && (
        <div className="mt-6 space-y-2">
          {webmcpChecks.map((check) => (
            <div key={check.check_name} className="flex items-center gap-2">
              {check.passed ? (
                <Check className="h-4 w-4 text-[#0CCE6B] shrink-0" />
              ) : (
                <X className="h-4 w-4 text-[#FF4E42] shrink-0" />
              )}
              <span
                className={cn(
                  "text-sm",
                  check.passed ? "text-[#1A1A1A]" : "text-[#6B6B6B]"
                )}
              >
                {check.check_label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
