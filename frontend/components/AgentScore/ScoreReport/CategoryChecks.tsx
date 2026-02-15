"use client";

import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckRow } from "./CheckRow";
import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import type {
  AgentScoreReport,
} from "@/components/AgentScore/AgentScore.types";
import {
  getVisibleCategories,
  getCategoryScore,
  getCategoryLabel,
} from "@/components/AgentScore/AgentScore.types";

interface CategoryChecksProps {
  report: AgentScoreReport;
  /** Ref map for scrolling to categories */
  categoryRefs?: Record<string, React.RefObject<HTMLDivElement | null>>;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    setIsDesktop(window.innerWidth >= 768);
  }, []);
  return isDesktop;
}

export function CategoryChecks({
  report,
  categoryRefs,
}: CategoryChecksProps) {
  const isDesktop = useIsDesktop();

  // Only show categories that have checks in this report
  const visibleCategories = getVisibleCategories(report);

  const checksByCategory = visibleCategories.reduce(
    (acc, cat) => {
      acc[cat] = report.checks.filter((c) => c.category === cat);
      return acc;
    },
    {} as Record<string, typeof report.checks>
  );

  // On desktop, expand all categories. On mobile, start collapsed.
  const defaultExpanded = isDesktop ? [...visibleCategories] : [];

  return (
    <Accordion
      type="multiple"
      defaultValue={defaultExpanded}
      className="space-y-3"
    >
      {visibleCategories.map((category) => {
        const checks = checksByCategory[category];
        const score = getCategoryScore(report, category);
        const evaluatedChecks = checks.filter((c) => c.status !== "dnf");
        const passedCount = evaluatedChecks.filter((c) => c.passed).length;
        const dnfCount = checks.length - evaluatedChecks.length;

        // Sort: failed first, DNF second, passed last
        const sortedChecks = [...checks].sort((a, b) => {
          const order = (c: typeof checks[number]) =>
            c.status === "dnf" ? 1 : c.passed ? 2 : 0;
          return order(a) - order(b);
        });

        const passedLabel =
          dnfCount > 0
            ? `${passedCount}/${evaluatedChecks.length} passed, ${dnfCount} could not run`
            : `${passedCount}/${checks.length} passed`;

        return (
          <AccordionItem
            key={category}
            value={category}
            ref={categoryRefs?.[category]}
            className="border border-[#D4D4D4] rounded-lg bg-white overflow-hidden"
          >
            <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-[#F9F7F3] transition-colors [&[data-state=open]>div>.gauge-wrapper]:scale-100">
              <div className="flex items-center gap-4 w-full">
                <div className="gauge-wrapper transition-transform">
                  <ScoreGauge score={score} size="sm" animated={false} />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-base font-semibold text-[#1A1A1A]">
                    {getCategoryLabel(report, category)}
                  </span>
                </div>
                <span className="text-sm text-[#6B6B6B] shrink-0">
                  {passedLabel}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-4">
              <div className="divide-y divide-[#E8E4DC]">
                {sortedChecks.map((check, i) => (
                  <CheckRow key={check.check_name} check={check} index={i} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
