"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import type { AgentScoreReport } from "@/components/AgentScore/AgentScore.types";

interface ReportHeaderActionsProps {
  report: AgentScoreReport;
  onResync: (url: string, testSignup: boolean) => void;
  isResyncing: boolean;
}

export function ReportHeaderActions({
  report,
  onResync,
  isResyncing,
}: ReportHeaderActionsProps) {
  const reportCreatedAt = parseISO(report.created_at);
  const lastRunLabel = format(reportCreatedAt, "MMM d, yyyy 'at' h:mm a");
  const lastRunRelative = formatDistanceToNow(reportCreatedAt, { addSuffix: true });

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <p className="text-xs text-[#4A4A4A] text-left sm:text-right">
        Last run:{" "}
        <span className="text-[#1A1A1A] font-semibold">
          {lastRunLabel}
        </span>{" "}
        ({lastRunRelative})
      </p>
      <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
        <button
          onClick={() => onResync(report.url, report.signup_test_enabled)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 h-8 bg-[#FFF7EF] border border-[#FFD8B3] text-[#A14A00] text-xs font-medium rounded-full hover:bg-[#FFEBD6] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          type="button"
          disabled={isResyncing}
        >
          {isResyncing ? "Re-syncing..." : "Re-sync and rerun test"}
        </button>
      </div>
    </div>
  );
}
