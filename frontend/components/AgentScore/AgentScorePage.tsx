"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Globe, FileSearch, Monitor, Blocks } from "lucide-react";
import { agentScoreReportQuery, scanUrlMutation } from "@/queries/agentScore.queries";
import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import { ALL_CATEGORIES, CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from "./AgentScore.types";
import { ScanInput } from "./ScanInput";
import { ScanProgress } from "./ScanProgress";
import { ScoreReport } from "./ScoreReport";
import { ReportHeaderActions } from "./ScoreReport/ReportHeaderActions";
import { AgentReadinessGuide } from "./AgentReadinessGuide";

type PagePhase = "input" | "loading" | "scanning" | "report";

const SCAN_STEPS = [
  {
    number: 1,
    icon: Globe,
    title: "Fetch your page",
    description: "We request your URL from our server, just like an AI agent would.",
  },
  {
    number: 2,
    icon: FileSearch,
    title: "Analyze content",
    description: "We check llms.txt, robots.txt, structured data, token efficiency, and permissions.",
  },
  {
    number: 3,
    icon: Monitor,
    title: "Test interaction & signup",
    description: "We render your page in a browser, test forms and navigation, and attempt agent signup — all in parallel.",
  },
  {
    number: 4,
    icon: Blocks,
    title: "Detect WebMCP tools & score",
    description: "We detect registered tools and schemas, then weight each check to produce your readiness score.",
  },
];

export function AgentScorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportParam = searchParams.get("report");

  // State
  const [phase, setPhase] = useState<PagePhase>(reportParam ? "loading" : "input");
  const [reportId, setReportId] = useState<string | null>(reportParam);
  const [scanStartedAt, setScanStartedAt] = useState<number>(Date.now());
  const [scanError, setScanError] = useState<string | undefined>();
  const [scanUrl, setScanUrl] = useState("");

  // Polling query — active when we have a reportId and are scanning or viewing
  const { data: report } = useQuery(
    agentScoreReportQuery(reportId ?? "", phase !== "input" && !!reportId)
  );

  // Scan mutation
  const scan = useMutation({
    ...scanUrlMutation(),
    onSuccess: (data) => {
      setReportId(data.report_id);
      setScanStartedAt(Date.now());
      setScanError(undefined);

      // If the backend returned a cached complete report, go straight to report
      if (data.status === "complete") {
        setPhase("report");
      } else {
        setPhase("scanning");
      }

      // Push report ID to URL for shareability
      router.push(`/tools/agent-score?report=${data.report_id}`, { scroll: false });
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error ? error.message : "Something went wrong. Try again.";
      // Try to extract DRF error detail
      const axiosErr = error as { response?: { data?: { detail?: string; url?: string[] } } };
      const detail =
        axiosErr?.response?.data?.detail ||
        axiosErr?.response?.data?.url?.[0] ||
        msg;
      setScanError(detail);
    },
  });

  // Transition phases based on report status
  useEffect(() => {
    if (!report) return;
    if (reportId && report.id !== reportId) return;

    // Loading phase: initial fetch for a report loaded via URL param
    if (phase === "loading") {
      if (report.status === "complete") {
        setPhase("report");
      } else if (report.status === "failed") {
        setScanError(report.error_message || "Scan failed. Try again.");
        setPhase("input");
        setReportId(null);
        router.push("/tools/agent-score", { scroll: false });
      } else {
        // Still in progress — now show scanning UI
        setPhase("scanning");
      }
      return;
    }

    // Scanning phase: poll until complete or failed
    if (phase === "scanning" && report.status === "complete") {
      setPhase("report");
    }
    if (phase === "scanning" && report.status === "failed") {
      setScanError(report.error_message || "Scan failed. Try again.");
      setPhase("input");
      setReportId(null);
      router.push("/tools/agent-score", { scroll: false });
    }
  }, [report, reportId, phase, router]);

  // Handle "Scan Another"
  const handleScanAnother = useCallback(() => {
    setPhase("input");
    setReportId(null);
    setScanError(undefined);
    router.push("/tools/agent-score", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router]);

  // Handle scan submit
  const handleScan = useCallback(
    (url: string, testSignup: boolean = true, forceRescan: boolean = false) => {
      setScanError(undefined);
      setScanUrl(url);
      if (forceRescan) {
        setReportId(null);
        setPhase("scanning");
        setScanStartedAt(Date.now());
      }
      scan.mutate({ url, testSignup, forceRescan });
    },
    [scan]
  );

  return (
    <div>
      {/* Header */}
      <div
        className={
          phase === "report"
            ? "mb-10 max-w-5xl mx-auto"
            : "text-center mb-10"
        }
      >
        {phase === "report" && report && report.status === "complete" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <div className="hidden sm:block" />
            <h1 className="font-editorial text-center text-[28px] sm:text-[40px] text-[#1A1A1A] leading-tight">
              Agent Readiness Score
            </h1>
            <div className="sm:justify-self-end">
              <ReportHeaderActions
                report={report}
                onResync={(url, testSignup) => handleScan(url, testSignup, true)}
                isResyncing={scan.isPending}
              />
            </div>
          </div>
        ) : (
          <div>
            <h1 className="font-editorial text-[28px] sm:text-[40px] text-[#1A1A1A] leading-tight">
              Agent Readiness Score
            </h1>
            {phase === "input" && (
              <p className="text-[#6B6B6B] text-base sm:text-lg mt-3 max-w-lg mx-auto">
                Agents are coming. Are you ready?
              </p>
            )}
          </div>
        )}
      </div>

      {/* Input bar — always visible, dimmed when scanning */}
      {(phase === "input" || phase === "scanning") && (
        <ScanInput
          onScan={(url, testSignup) => handleScan(url, testSignup)}
          isScanning={phase === "scanning" || scan.isPending}
          error={scanError}
          initialUrl={scanUrl}
        />
      )}

      {phase === "input" && (
        <p className="text-center text-sm text-[#6B6B6B] mt-4">
          Free. No signup. Results in about a minute.
        </p>
      )}

      {/* Pre-scan preview */}
      {phase === "input" && (
        <div className="mt-12 max-w-4xl mx-auto">
          {/* Greyed-out category gauges */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
            {ALL_CATEGORIES.map((category) => (
              <div key={category} className="flex flex-col items-center opacity-40">
                <ScoreGauge score={0} size="sm" label={CATEGORY_LABELS[category]} animated={false} />
                <p className="text-[10px] text-[#6B6B6B] mt-1 max-w-[100px] text-center leading-tight">
                  {CATEGORY_DESCRIPTIONS[category]}
                </p>
              </div>
            ))}
          </div>

          {/* Color legend */}
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-[#6B6B6B]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-[#FF4E42]" />
              0&ndash;49
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-[#FFA400]" />
              50&ndash;89
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-[#0CCE6B]" />
              90&ndash;100
            </span>
          </div>

          {/* Methodology explainer */}
          <div className="mt-10">
            <h2 className="text-center text-lg font-semibold text-[#1A1A1A] mb-5">
              How we score your site
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SCAN_STEPS.map((step) => (
                <div
                  key={step.number}
                  className="flex items-start gap-3 bg-white border border-[#E8E4DC] rounded-lg p-4"
                >
                  <div className="shrink-0 mt-0.5 text-[#FF6E00]">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">
                      {step.number}. {step.title}
                    </p>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEO content: full check descriptions */}
          <AgentReadinessGuide />
        </div>
      )}

      {/* Loading state — brief skeleton while fetching an existing report */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8E4DC] border-t-[#FF6E00]" />
          <p className="text-sm text-[#6B6B6B]">Loading report&hellip;</p>
        </div>
      )}

      {/* Scanning progress */}
      {phase === "scanning" && <ScanProgress startedAt={scanStartedAt} report={report} />}

      {/* Report */}
      {phase === "report" && report && report.status === "complete" && (
        <ScoreReport
          report={report}
          onScanAnother={handleScanAnother}
        />
      )}
    </div>
  );
}
