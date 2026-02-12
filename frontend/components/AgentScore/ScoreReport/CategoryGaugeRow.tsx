"use client";

import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import type { AgentScoreReport, CheckCategory } from "@/components/AgentScore/AgentScore.types";
import { ALL_CATEGORIES, CATEGORY_LABELS, getCategoryScore } from "@/components/AgentScore/AgentScore.types";

interface CategoryGaugeRowProps {
  report: AgentScoreReport;
  onCategoryClick?: (category: CheckCategory) => void;
}

export function CategoryGaugeRow({ report, onCategoryClick }: CategoryGaugeRowProps) {
  // Only show categories that are active (signup_test may be absent)
  const visibleCategories = ALL_CATEGORIES.filter((cat) => {
    if (cat === "signup_test") return report.signup_test_enabled;
    return true;
  });

  return (
    <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
      {visibleCategories.map((category) => {
        const score = getCategoryScore(report, category);
        return (
          <button
            key={category}
            onClick={() => onCategoryClick?.(category)}
            className="flex flex-col items-center hover:opacity-80 transition-opacity cursor-pointer"
            type="button"
          >
            <ScoreGauge
              score={score}
              size="sm"
              label={CATEGORY_LABELS[category]}
            />
          </button>
        );
      })}
    </div>
  );
}
