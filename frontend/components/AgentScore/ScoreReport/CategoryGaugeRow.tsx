"use client";

import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import type { AgentScoreReport } from "@/components/AgentScore/AgentScore.types";
import { getVisibleCategories, getCategoryScore, getCategoryLabel } from "@/components/AgentScore/AgentScore.types";

interface CategoryGaugeRowProps {
  report: AgentScoreReport;
  onCategoryClick?: (category: string) => void;
}

export function CategoryGaugeRow({ report, onCategoryClick }: CategoryGaugeRowProps) {
  const visibleCategories = getVisibleCategories(report);

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
              label={getCategoryLabel(report, category)}
            />
          </button>
        );
      })}
    </div>
  );
}
