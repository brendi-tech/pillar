"use client";

import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import {
  agentScoreDomainLookupQuery,
  agentScoreReportQuery,
  scanUrlMutation,
} from "@/queries/agentScore.queries";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Blocks,
  ExternalLink,
  FileSearch,
  Globe,
  Monitor,
  Terminal,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AgentReadinessGuide } from "./AgentReadinessGuide";
import { DEFAULT_CATEGORY_CONFIG } from "./AgentScore.types";
import { CompanyShowcase } from "./CompanyShowcase";
import { ScanInput } from "./ScanInput";
import { ScanProgress } from "./ScanProgress";
import { ScoreReport } from "./ScoreReport";
import { ReportHeaderActions } from "./ScoreReport/ReportHeaderActions";

type PagePhase = "input" | "loading" | "scanning" | "report";

const SCAN_STEPS = [
  {
    number: 1,
    icon: Globe,
    title: "Fetch your page",
    description:
      "We request your URL from our server, just like an AI agent would.",
  },
  {
    number: 2,
    icon: FileSearch,
    title: "Analyze content",
    description:
      "We check llms.txt, robots.txt, structured data, token efficiency, and permissions.",
  },
  {
    number: 3,
    icon: Monitor,
    title: "Test interaction & signup",
    description:
      "We render your page in a browser, test forms and navigation, and attempt agent signup — all in parallel.",
  },
  {
    number: 4,
    icon: Blocks,
    title: "Detect WebMCP tools & score",
    description:
      "We detect registered tools and schemas, then weight each check to produce your readiness score.",
  },
];

export function AgentScorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportParam = searchParams.get("report");
  const domainParam = searchParams.get("domain");

  // State
  const hasDomain = !!domainParam && !reportParam;
  const [phase, setPhase] = useState<PagePhase>(
    reportParam ? "loading" : hasDomain ? "loading" : "input"
  );
  const [reportId, setReportId] = useState<string | null>(reportParam);
  const [scanStartedAt, setScanStartedAt] = useState<number>(Date.now());
  const [scanError, setScanError] = useState<string | undefined>();
  const [scanUrl, setScanUrl] = useState("");
  const [domainLookupDone, setDomainLookupDone] = useState(false);

  // Domain lookup query — fires when ?domain= is present and no ?report=
  const { data: domainReport, isFetched: domainLookupFetched } = useQuery(
    agentScoreDomainLookupQuery(
      domainParam ?? "",
      hasDomain && !domainLookupDone
    )
  );

  // Handle domain lookup result
  useEffect(() => {
    if (!hasDomain || domainLookupDone || !domainLookupFetched) return;

    setDomainLookupDone(true);

    if (domainReport) {
      // Found a report — show it directly
      setReportId(domainReport.id);
      setPhase("report");
      // Update URL to include report ID for shareability
      router.replace(`/tools/agent-score?report=${domainReport.id}`, {
        scroll: false,
      });
    } else {
      // No report found — prefill the input with the domain
      setScanUrl(`https://${domainParam}`);
      setPhase("input");
    }
  }, [
    hasDomain,
    domainReport,
    domainLookupFetched,
    domainLookupDone,
    domainParam,
    router,
  ]);

  // Polling query — active when we have a reportId and are scanning or viewing.
  // Skip polling when the domain lookup already supplied this exact report.
  const domainDataCoversReport = domainReport?.id === reportId;
  const { data: polledReport } = useQuery(
    agentScoreReportQuery(
      reportId ?? "",
      phase !== "input" && !!reportId && !domainDataCoversReport
    )
  );

  // Use domain report data if it matches, otherwise use polled report
  const report = domainDataCoversReport ? domainReport : polledReport;

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
      router.push(`/tools/agent-score?report=${data.report_id}`, {
        scroll: false,
      });
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error
          ? error.message
          : "Something went wrong. Try again.";
      // Try to extract DRF error detail
      const axiosErr = error as {
        response?: { data?: { detail?: string; url?: string[] } };
      };
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

    // Scanning phase: show report as soon as partial results are available
    if (phase === "scanning" && report.progress?.analyzers_done) {
      setPhase("report");
    }
    // Also handle full completion
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
    setScanUrl("");
    router.push("/tools/agent-score", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router]);

  // Handle scan submit
  const handleScan = useCallback(
    (url: string, forceRescan: boolean = false) => {
      setScanError(undefined);
      setScanUrl(url);
      if (forceRescan) {
        setReportId(null);
        setPhase("scanning");
        setScanStartedAt(Date.now());
      }
      scan.mutate({ url, forceRescan });
    },
    [scan]
  );

  return (
    <div className="w-full overflow-hidden">
      {/* Header */}
      <div
        className={
          phase === "report" ? "mb-10 max-w-5xl mx-auto" : "text-center mb-10"
        }
      >
        {phase === "report" && report ? (
          <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-[1fr_auto_1fr] md:items-start pt-8">
            <div className="hidden md:block" />
            <h1 className="font-editorial text-center text-[28px] sm:text-[40px] text-[#1A1A1A] leading-tight">
              Agent Readiness Score
            </h1>
            <div className="md:justify-self-end">
              {report.status === "complete" && (
                <ReportHeaderActions
                  report={report}
                  onResync={(url) => handleScan(url, true)}
                  isResyncing={scan.isPending}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="relative pt-12">
            {/* Decorative radial glow behind hero */}
            {phase === "input" && (
              <div
                className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 sm:w-[600px] w-[400px] h-[300px] opacity-[0.12]"
                style={{
                  background:
                    "radial-gradient(ellipse at center, #FF6E00 0%, transparent 70%)",
                }}
              />
            )}
            <h1 className="font-editorial text-[28px] sm:text-[44px] text-[#1A1A1A] leading-tight relative">
              Agent Readiness Score
            </h1>
            {phase === "input" && (
              <p className="text-[#6B6B6B] text-base sm:text-lg mt-3 max-w-lg mx-auto relative">
                Agents are coming. Are you ready?
              </p>
            )}
          </div>
        )}
      </div>

      {/* Input bar — always visible, dimmed when scanning */}
      {(phase === "input" || phase === "scanning") && (
        <div className="relative max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-[0_2px_24px_rgba(0,0,0,0.06)] p-6 sm:p-8">
            <ScanInput
              onScan={(url) => handleScan(url)}
              isScanning={phase === "scanning" || scan.isPending}
              error={scanError}
              initialUrl={scanUrl}
            />
          </div>
          {phase === "input" && (
            <p className="text-center text-sm text-[#999] mt-4">
              Free. No signup. Results in about a minute.
            </p>
          )}
        </div>
      )}

      {/* Pre-scan preview */}
      {phase === "input" && (
        <div className="mt-16 max-w-4xl mx-auto">
          {/* Greyed-out category gauges */}
          <div className="relative bg-gradient-to-b from-[#FAFAF8] to-white rounded-2xl border border-[#EDEBE6] px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-wrap justify-center items-stretch gap-8 sm:gap-12">
              {Object.entries(DEFAULT_CATEGORY_CONFIG)
                .sort(([, a], [, b]) => a.sort_order - b.sort_order)
                .map(([category, cfg]) => {
                  const unscored = !cfg.scored;
                  return (
                    <div
                      key={category}
                      className="flex items-stretch gap-8 sm:gap-12"
                    >
                      {/* Thin vertical divider before unscored categories */}
                      {unscored && (
                        <div className="hidden sm:flex items-center">
                          <div className="w-px h-3/5 bg-[#D8D8D8] opacity-50" />
                        </div>
                      )}
                      <div
                        className={`flex flex-col items-center ${unscored ? "opacity-25" : "opacity-35"}`}
                      >
                        <ScoreGauge
                          score={0}
                          size="sm"
                          label={`${cfg.label}${unscored ? " *" : ""}`}
                          animated={false}
                        />
                        <p className="text-[10px] text-[#888] mt-1.5 max-w-[100px] text-center leading-tight">
                          {cfg.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Color legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 mt-7 text-xs text-[#999]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#FF4E42]" />
                0&ndash;49
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#FFA400]" />
                50&ndash;89
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#0CCE6B]" />
                90&ndash;100
              </span>
            </div>
            <p className="text-center text-[10px] text-[#999] mt-2 opacity-70">
              * Not included in overall score
            </p>
          </div>

          {/* Social proof: how real companies score */}
          <CompanyShowcase />

          {/* Methodology explainer */}
          <div className="mt-16">
            {/* Section divider */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#E8E4DC] to-transparent" />
              <h2 className="text-lg font-semibold text-[#1A1A1A] shrink-0">
                How we score your site
              </h2>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#E8E4DC] to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SCAN_STEPS.map((step) => (
                <div
                  key={step.number}
                  className="group flex items-start gap-4 bg-white border border-[#E8E4DC] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-[#FF6E00]/20 transition-all duration-200"
                >
                  <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-[#FFF4EB] text-[#FF6E00] group-hover:bg-[#FF6E00] group-hover:text-white transition-colors duration-200">
                    <step.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A1A]">
                      {step.number}. {step.title}
                    </p>
                    <p className="text-[13px] text-[#6B6B6B] mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Run it yourself CTA */}
          <div className="mt-16">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#E8E4DC] to-transparent" />
              <h2 className="text-lg font-semibold text-[#1A1A1A] shrink-0">
                Run it yourself
              </h2>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#E8E4DC] to-transparent" />
            </div>
            <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-start gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/openclaw-logo.svg"
                  alt="OpenClaw"
                  className="hidden sm:block w-12 h-12 shrink-0 mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm text-[#6B6B6B] leading-relaxed">
                    The agent test that powers part of this score is an
                    open-source{" "}
                    <a
                      href="https://openclaw.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF6E00] hover:text-[#E06200] font-medium"
                    >
                      OpenClaw
                    </a>{" "}
                    skill. Install it and run it locally against any site — no
                    account needed.
                  </p>
                  <div className="mt-4 bg-[#1A1A1A] rounded-lg px-4 py-3 font-mono text-sm text-[#E8E4DC] flex items-center gap-3 overflow-x-auto">
                    <Terminal className="h-4 w-4 text-[#666] shrink-0" />
                    <code className="whitespace-nowrap">
                      openclaw skill install pillarhq/openclaw-agent-score
                    </code>
                  </div>
                  <p className="text-xs text-[#999] mt-3">
                    Then ask your agent:{" "}
                    <span className="text-[#6B6B6B] font-medium">
                      &quot;Run agent-score on https://your-site.com&quot;
                    </span>
                  </p>
                  <a
                    href="https://github.com/pillarhq/openclaw-agent-score"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-[#FF6E00] hover:text-[#E06200] font-medium mt-4"
                  >
                    View on GitHub
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
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
      {phase === "scanning" && (
        <ScanProgress startedAt={scanStartedAt} report={report} />
      )}

      {/* Report (shown for both partial and complete states) */}
      {phase === "report" && report && (
        <ScoreReport report={report} onScanAnother={handleScanAnother} />
      )}
    </div>
  );
}
