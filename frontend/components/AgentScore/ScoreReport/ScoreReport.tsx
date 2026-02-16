"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Link2, Check, Info, AlertTriangle, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { SessionReplay } from "@/components/AgentScore/SessionReplay";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import { ActivityLog } from "./ActivityLog";
import { CheckRow } from "./CheckRow";
import { EmailSubscribe } from "./EmailSubscribe";
import { ReportCTA } from "./ReportCTA";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  AgentScoreReport,
  ScanNote,
  OpenclawData,
  SignupTestData,
  LayerState,
} from "@/components/AgentScore/AgentScore.types";
import {
  getVisibleCategories,
  getScoredCategories,
  getCategoryScore,
  getCategoryLabel,
  isUnscoredCategory,
} from "@/components/AgentScore/AgentScore.types";

function getScoreColor(score: number | null): string {
  if (score === null) return "#9A9A9A";
  if (score >= 90) return "#0CCE6B";
  if (score >= 50) return "#FFA400";
  return "#FF4E42";
}

interface ScoreReportProps {
  report: AgentScoreReport;
  onScanAnother: () => void;
}

export function ScoreReport({
  report,
  onScanAnother,
}: ScoreReportProps) {
  const [copied, setCopied] = useState(false);

  // Partial state: report has some scores but signup/overall still pending
  const isPartial = report.status !== "complete";

  // Derive visible categories from the report's category_config
  const visibleCategories = useMemo(
    () => getVisibleCategories(report),
    [report]
  );

  // Find the lowest-scoring *scored* category to select by default.
  // Unscored categories (e.g. WebMCP) are excluded — most sites score 0
  // there, so it's not a useful default.  null scores (all-DNF categories)
  // are treated as Infinity so they don't "win" lowest unless everything is null.
  const lowestCategory = useMemo(() => {
    const scored = getScoredCategories(report);
    const scoredVisible = visibleCategories.filter((c) => scored.includes(c));
    const candidates = scoredVisible.length > 0 ? scoredVisible : visibleCategories;
    let lowest: string = candidates[0];
    let lowestScore = getCategoryScore(report, lowest) ?? Infinity;
    for (const cat of candidates) {
      const s = getCategoryScore(report, cat) ?? Infinity;
      if (s < lowestScore) {
        lowestScore = s;
        lowest = cat;
      }
    }
    return lowest;
  }, [report, visibleCategories]);

  const [activeCategory, setActiveCategory] =
    useState<string>(lowestCategory);

  const activeScore = getCategoryScore(report, activeCategory);

  // Sort: failed first (red), then DNF (gray), then passed (green)
  const activeChecks = useMemo(() => {
    const checks = report.checks.filter(
      (c) => c.category === activeCategory
    );
    return [...checks].sort((a, b) => {
      const order = (c: typeof checks[number]) =>
        c.status === "dnf" ? 1 : c.passed ? 2 : 0;
      return order(a) - order(b);
    });
  }, [report.checks, activeCategory]);

  // Split checks into two columns (first half left, second half right)
  const midpoint = Math.ceil(activeChecks.length / 2);
  const leftChecks = activeChecks.slice(0, midpoint);
  const rightChecks = activeChecks.slice(midpoint);

  // Token metrics for rules tab (content checks live here now)
  const showTokenMetrics =
    activeCategory === "rules" && report.token_metrics;

  // WebMCP CTA for webmcp tab
  const showWebMCPCta =
    activeCategory === "webmcp" && (report.webmcp_score === null || report.webmcp_score < 90);

  // Per-layer state enums from the serializer — single source of truth
  const signupState: LayerState = report.progress?.signup_test_state ?? "disabled";
  const openclawState: LayerState = report.progress?.openclaw_test_state ?? "disabled";

  // Signup test narrative — supports both new (self-scoring) and legacy shapes
  const showSignupNarrative = activeCategory === "signup_test";
  const rawSignupData = report.signup_test_data;
  // New shape has `summary`; legacy shape has `outcome.outcome_type`
  const isNewSignupShape = rawSignupData && "summary" in rawSignupData;
  const signupData = isNewSignupShape ? (rawSignupData as SignupTestData) : null;
  // Legacy fallback
  const legacyOutcome = !isNewSignupShape
    ? (rawSignupData?.outcome as Record<string, unknown> | undefined)
    : null;
  const legacyOutcomeType = legacyOutcome?.outcome_type as string | undefined;
  const legacyOutcomeDetail = legacyOutcome?.detail as string | undefined;
  const hasSignupData = !!signupData?.summary || !!legacyOutcome;
  const hasSessionRecording = !!(signupData?.session_id ?? rawSignupData?.session_id);

  // OpenClaw narrative data (only needed when state is "success")
  const showOpenclawNarrative = activeCategory === "openclaw";
  const openclawData = report.openclaw_data as OpenclawData | undefined;

  // Helper: determine if a specific category is still loading.
  // Uses category-specific layer states so errored/completed categories
  // stop spinning even while the overall report is still running.
  const isCategoryLoading = useCallback(
    (category: string, score: number | null): boolean => {
      if (!isPartial) return false;
      if (score !== null) return false;

      // Openclaw and signup have explicit layer states
      if (category === "openclaw") return openclawState === "running";
      if (category === "signup_test") return signupState === "running";

      // Rules/webmcp are done once scoring completes
      if (report.progress?.scoring_done) return false;

      return true;
    },
    [isPartial, openclawState, signupState, report.progress?.scoring_done]
  );

  // Is the active category still loading? Used for gauge spinner + checks placeholder.
  const activeCategoryLoading = isCategoryLoading(activeCategory, activeScore);

  // Map each category to the workflows whose activity log entries are relevant
  const CATEGORY_WORKFLOWS: Record<string, string[]> = useMemo(
    () => ({
      openclaw: ["openclaw_test"],
      signup_test: ["signup_test"],
      rules: ["http_probes", "browser_analysis", "analyze_and_score"],
      webmcp: ["browser_analysis", "analyze_and_score"],
    }),
    []
  );
  const activeCategoryWorkflows = CATEGORY_WORKFLOWS[activeCategory];

  // Scan notes relevant to the active category (or general notes)
  const activeNotes = useMemo(() => {
    const notes = report.scan_notes ?? [];
    return notes.filter(
      (n: ScanNote) => n.category === activeCategory || n.category === null
    );
  }, [report.scan_notes, activeCategory]);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="mt-8 max-w-5xl mx-auto">
      {/* Section 1: Overall score */}
      <div className="text-center">
        <p className="text-sm text-[#6B6B6B] mb-4">
          Results for{" "}
          <a
            href={report.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1A1A1A] font-medium hover:text-[#FF6E00] transition-colors underline underline-offset-2"
          >
            {report.domain}
          </a>
        </p>
        <div className="flex justify-center">
          <ScoreGauge
            score={report.overall_score}
            size="lg"
            label="Agent Readiness Score"
            loading={isPartial}
          />
        </div>
        {isPartial && (
          <p className="text-sm text-[#6B6B6B] mt-3 animate-pulse">
            {report.progress?.signup_test_state === "running"
              ? "Finishing signup test\u2026"
              : report.progress?.openclaw_test_state === "running"
                ? "Finishing agent experience test\u2026"
                : "Calculating final scores\u2026"}
          </p>
        )}
        <div className="mt-4 flex justify-center">
          {!isPartial && (
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 h-8 bg-white border border-[#D8D8D8] text-[#3A3A3A] text-xs font-medium rounded-full hover:bg-[#F8F8F8] transition-colors"
              type="button"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Link copied!
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  Share this report
                </>
              )}
            </button>
          )}
        </div>
        {isPartial && (
          <div className="mt-6 max-w-md mx-auto">
            <EmailSubscribe reportId={report.id} />
          </div>
        )}
      </div>

      {/* Section 2: Category tab row */}
      <div className="mt-10">
        <div className="flex flex-wrap justify-center items-stretch gap-3 sm:gap-4">
          {visibleCategories.map((category) => {
            const score = getCategoryScore(report, category);
            const categoryLoading = isCategoryLoading(category, score);
            const color = categoryLoading ? "#FF6E00" : getScoreColor(score);
            const isActive = category === activeCategory;
            const unscored = isUnscoredCategory(report, category);

            return (
              <div key={category} className="flex items-stretch gap-3 sm:gap-4">
                {/* Thin vertical divider before unscored categories */}
                {unscored && (
                  <div className="hidden sm:flex items-center">
                    <div className="w-px h-3/5 bg-[#D8D8D8]" />
                  </div>
                )}
                <button
                  onClick={() => setActiveCategory(category)}
                  className={cn(
                    "flex flex-col items-center px-4 py-3 rounded-xl border-2 transition-all cursor-pointer",
                    isActive
                      ? "bg-white shadow-md"
                      : "bg-transparent border-transparent hover:bg-white/60",
                    unscored && !categoryLoading && "opacity-60"
                  )}
                  style={{
                    borderColor: isActive ? color : "transparent",
                  }}
                  type="button"
                >
                  <ScoreGauge
                    score={score}
                    size="sm"
                    animated={false}
                    loading={categoryLoading}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium mt-1",
                      isActive ? "text-[#1A1A1A]" : "text-[#6B6B6B]"
                    )}
                  >
                    {getCategoryLabel(report, category)}{unscored && !categoryLoading && " *"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Color legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 mt-5 text-xs text-[#6B6B6B]">
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
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#9A9A9A]" />
            Could not evaluate
          </span>
        </div>
        {visibleCategories.some((c) => isUnscoredCategory(report, c)) && (
          <p className="text-center text-[11px] text-[#999] mt-2">
            * Not included in overall score
          </p>
        )}
      </div>

      {/* Section 3: Detail panel for active category */}
      <div className="mt-8 bg-white border border-[#D4D4D4] rounded-xl shadow-sm p-6 sm:p-10">
        {/* Category gauge (medium) */}
        <div className="flex justify-center">
          <ScoreGauge
            score={activeScore}
            size="md"
            label={getCategoryLabel(report, activeCategory)}
            loading={activeCategoryLoading}
          />
        </div>

        {/* Self-score note (OpenClaw + Signup Test) */}
        {showOpenclawNarrative && openclawState === "success" && (
          <p className="text-center text-xs text-[#999] mt-2">
            Score reflects the agent&apos;s overall experience, not individual check results
          </p>
        )}
        {showSignupNarrative && signupData && signupState === "success" && (
          <p className="text-center text-xs text-[#999] mt-2">
            Score reflects the agent&apos;s signup experience, not individual check results
          </p>
        )}

        {/* WebMCP CTA banner */}
        {showWebMCPCta && (
          <Link
            href="/signup"
            className="flex items-center justify-center gap-2 w-full mt-6 h-11 px-6 text-sm font-medium rounded-lg bg-[#FF6E00] hover:bg-[#E06200] text-white transition-colors"
          >
            {report.webmcp_score === 0 || report.webmcp_score === null
              ? "Add WebMCP to your site with Pillar"
              : "Improve your WebMCP score with Pillar"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        {/* Token metrics for readability */}
        {showTokenMetrics && (
          <div className="mt-6 flex flex-wrap justify-center gap-4 sm:gap-8 text-center">
            {report.token_metrics.supports_markdown_negotiation && (
              <div className="bg-[#F9F7F3] rounded-lg px-5 py-3">
                <p className="text-xl font-mono font-bold text-[#0CCE6B] tabular-nums">
                  {report.token_metrics.token_reduction_percent != null
                    ? `${Math.round(report.token_metrics.token_reduction_percent)}%`
                    : "Yes"}
                </p>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Token reduction via Markdown
                </p>
              </div>
            )}
            {report.token_metrics.content_signal && (
              <div className="bg-[#F9F7F3] rounded-lg px-5 py-3">
                <p className="text-sm font-mono font-medium text-[#1A1A1A]">
                  {report.token_metrics.content_signal}
                </p>
                <p className="text-xs text-[#6B6B6B] mt-1">Content-Signal</p>
              </div>
            )}
          </div>
        )}

        {/* Signup test narrative — live activity log while running */}
        {showSignupNarrative && signupState === "running" && (
          <>
            <div className="mt-6 rounded-lg bg-[#FFF8F0] border border-[#FFD6A5] p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-[#FF6E00] animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    Still testing signup&hellip;
                  </p>
                  <p className="text-sm text-[#6B6B6B] mt-1 leading-relaxed">
                    An AI agent is attempting to create an account on your site. This takes 30&ndash;60 seconds.
                  </p>
                </div>
              </div>
            </div>
            {report.activity_log?.length > 0 && (
              <ActivityLog
                entries={report.activity_log}
                filterWorkflow="signup_test"
                isLive
              />
            )}
          </>
        )}

        {/* New self-scoring signup narrative (OpenClaw-style) */}
        {showSignupNarrative && signupData && (
          <div className="mt-6 space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-[#F9F7F3] border border-[#E8E4DC] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Image src="/browserbase-logo.svg" alt="BrowserBase" width={16} height={16} className="shrink-0" />
                <span className="text-sm font-semibold text-[#1A1A1A]">What happened</span>
              </div>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                {signupData.summary || "The signup test completed but no summary was provided."}
              </p>
              {hasSessionRecording && (
                <SessionReplay
                  reportId={report.id}
                  instruction={signupData.instruction ?? undefined}
                />
              )}
            </div>

            {/* What worked / What didn't — two columns */}
            {((signupData.what_worked?.length ?? 0) > 0 || (signupData.what_didnt?.length ?? 0) > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(signupData.what_worked?.length ?? 0) > 0 && (
                  <div className="rounded-lg bg-[#F0FFF4] border border-[#C6F6D5] p-4">
                    <p className="text-xs font-semibold text-[#22543D] uppercase tracking-wide mb-2">What worked</p>
                    <ul className="space-y-1.5">
                      {signupData.what_worked.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#6B6B6B]">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#0CCE6B] mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(signupData.what_didnt?.length ?? 0) > 0 && (
                  <div className="rounded-lg bg-[#FFF5F5] border border-[#FED7D7] p-4">
                    <p className="text-xs font-semibold text-[#742A2A] uppercase tracking-wide mb-2">What didn&apos;t work</p>
                    <ul className="space-y-1.5">
                      {signupData.what_didnt.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#6B6B6B]">
                          <XCircle className="h-3.5 w-3.5 text-[#FF4E42] mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Screenshot of final page state */}
            {signupData.screenshot_url && (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="mx-auto rounded-lg border border-[#E8E4DC] overflow-hidden hover:border-[#999] transition-colors cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signupData.screenshot_url}
                      alt="Final page state after signup attempt"
                      className="w-full max-w-sm h-auto"
                    />
                    <p className="text-xs text-[#999] p-2 text-center">Final page state (click to expand)</p>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signupData.screenshot_url}
                    alt="Final page state after signup attempt"
                    className="w-full h-auto"
                  />
                </DialogContent>
              </Dialog>
            )}

            {/* Independent page verification */}
            {signupData.verification && (
              <div className="rounded-lg bg-[#F0F7FF] border border-[#BEE3F8] p-3">
                <p className="text-xs font-semibold text-[#2A4365] uppercase tracking-wide mb-1">
                  Independent page verification
                </p>
                <p className="text-sm text-[#6B6B6B]">
                  {signupData.verification.description}
                </p>
              </div>
            )}

            {/* Attribution */}
            <p className="text-center text-[11px] text-[#999]">
              Tested by{" "}
              <a
                href="https://www.browserbase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-[#6B6B6B] transition-colors inline-flex items-center gap-0.5"
              >
                Browserbase + Stagehand
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </p>

            {report.activity_log?.length > 0 && (
              <ActivityLog
                entries={report.activity_log}
                filterWorkflow="signup_test"
                defaultCollapsed
              />
            )}
          </div>
        )}

        {/* Legacy signup narrative (old reports without self-scoring) */}
        {showSignupNarrative && !signupData && legacyOutcome && (
          <div className="mt-6 rounded-lg bg-[#F9F7F3] border border-[#E8E4DC] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Image src="/browserbase-logo.svg" alt="BrowserBase" width={16} height={16} className="shrink-0" />
              <span className="text-sm font-semibold text-[#1A1A1A]">What happened</span>
            </div>
            <p className="text-sm text-[#6B6B6B] leading-relaxed">
              {legacyOutcomeType === "success" &&
                "An AI agent found your signup page and created a test account successfully."}
              {legacyOutcomeType === "verify_email" &&
                "An AI agent signed up and your site asked for email verification — that's a clear, agent-friendly outcome."}
              {legacyOutcomeType === "captcha_blocked" &&
                "The agent found your signup form but was blocked by a CAPTCHA. AI agents can't solve CAPTCHAs."}
              {legacyOutcomeType === "payment_required" &&
                "Signup requires payment information. Agents can't provide payment details."}
              {legacyOutcomeType === "no_signup_found" &&
                "No signup or registration page was found on your site."}
              {legacyOutcomeType === "form_error" &&
                (legacyOutcomeDetail || "The form was submitted but returned an error.")}
              {legacyOutcomeType === "redirect_unknown" &&
                (legacyOutcomeDetail || "The agent was redirected but the outcome was unclear.")}
              {legacyOutcomeType === "timeout" &&
                "The AI agent ran out of time before completing the signup flow. Your site may be slow to load or have a complex multi-step signup process."}
              {legacyOutcomeType === "error" &&
                (legacyOutcomeDetail || "The signup test encountered a technical error and could not complete.")}
              {legacyOutcomeType === "unknown" &&
                "The AI agent completed the signup flow but the outcome couldn't be clearly classified."}
              {!legacyOutcomeType &&
                "The signup test could not determine what happened."}
            </p>
            {hasSessionRecording && (
              <SessionReplay
                reportId={report.id}
                instruction={rawSignupData?.instruction as string | undefined}
              />
            )}
          </div>
        )}
        {showSignupNarrative && !signupData && legacyOutcome && report.activity_log?.length > 0 && (
          <ActivityLog
            entries={report.activity_log}
            filterWorkflow="signup_test"
            defaultCollapsed
          />
        )}

        {/* OpenClaw narrative — still running */}
        {showOpenclawNarrative && openclawState === "running" && (
          <>
            <div className="mt-6 rounded-lg bg-[#FFF8F0] border border-[#FFD6A5] p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-[#FF6E00] animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    OpenClaw is testing your site&hellip;
                  </p>
                  <p className="text-sm text-[#6B6B6B] mt-1 leading-relaxed">
                    A real AI agent is browsing your site, trying to navigate, sign up, and complete tasks. This takes 1&ndash;3 minutes.
                  </p>
                </div>
              </div>
            </div>
            {report.activity_log?.length > 0 && (
              <ActivityLog
                entries={report.activity_log}
                filterWorkflow="openclaw_test"
                isLive
              />
            )}
          </>
        )}
        {/* OpenClaw narrative — finished but errored or no usable data */}
        {showOpenclawNarrative && openclawState === "error" && (
          <>
            <div className="mt-6 rounded-lg bg-[#F9F7F3] border border-[#E8E4DC] p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-[#999] shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    {openclawData?.error
                      ? "Agent experience test failed"
                      : "Could not evaluate agent experience"}
                  </p>
                  <p className="text-sm text-[#6B6B6B] mt-1 leading-relaxed">
                    {openclawData?.error
                      ? "The agent experience test encountered an error before it could browse your site. This is an issue on our end, not with your site."
                      : "The AI agent browsed your site but wasn\u0027t able to produce a structured evaluation. This can happen when the site is complex or the agent encounters unexpected behavior."}
                  </p>
                </div>
              </div>
            </div>
            {report.activity_log?.length > 0 && (
              <ActivityLog
                entries={report.activity_log}
                filterWorkflow="openclaw_test"
                defaultCollapsed
              />
            )}
          </>
        )}
        {showOpenclawNarrative && openclawState === "success" && openclawData && (
          <div className="mt-6 space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-[#F9F7F3] border border-[#E8E4DC] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Image src="/openclaw-logo.svg" alt="OpenClaw" width={16} height={16} className="shrink-0" />
                <span className="text-sm font-semibold text-[#1A1A1A]">Agent&apos;s experience</span>
              </div>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                {openclawData.summary}
              </p>
            </div>

            {/* What worked / What didn't — two columns */}
            {(openclawData.what_worked.length > 0 || openclawData.what_didnt.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {openclawData.what_worked.length > 0 && (
                  <div className="rounded-lg bg-[#F0FFF4] border border-[#C6F6D5] p-4">
                    <p className="text-xs font-semibold text-[#22543D] uppercase tracking-wide mb-2">What worked</p>
                    <ul className="space-y-1.5">
                      {openclawData.what_worked.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#6B6B6B]">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#0CCE6B] mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {openclawData.what_didnt.length > 0 && (
                  <div className="rounded-lg bg-[#FFF5F5] border border-[#FED7D7] p-4">
                    <p className="text-xs font-semibold text-[#742A2A] uppercase tracking-wide mb-2">What didn&apos;t work</p>
                    <ul className="space-y-1.5">
                      {openclawData.what_didnt.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#6B6B6B]">
                          <XCircle className="h-3.5 w-3.5 text-[#FF4E42] mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Attribution */}
            <p className="text-center text-[11px] text-[#999]">
              Tested by{" "}
              <a
                href="https://openclaw.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-[#6B6B6B] transition-colors inline-flex items-center gap-0.5"
              >
                OpenClaw
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </p>

            {report.activity_log?.length > 0 && (
              <ActivityLog
                entries={report.activity_log}
                filterWorkflow="openclaw_test"
                defaultCollapsed
              />
            )}
          </div>
        )}

        {/* Scan notes for this category */}
        {activeNotes.length > 0 && (
          <div className="mt-6 flex flex-col gap-3">
            {activeNotes.map((note: ScanNote, i: number) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-4 flex items-start gap-3",
                  note.type === "warning"
                    ? "bg-[#FFF8F0] border-[#FFD6A5]"
                    : "bg-[#F0F4FF] border-[#C5D4F0]"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {note.type === "warning" ? (
                    <AlertTriangle className="h-4 w-4 text-[#E68A00]" />
                  ) : (
                    <Info className="h-4 w-4 text-[#4A7AD7]" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      note.type === "warning"
                        ? "text-[#9A5C00]"
                        : "text-[#2D5BA0]"
                    )}
                  >
                    {note.title}
                  </p>
                  <p className="text-sm text-[#6B6B6B] mt-1 leading-relaxed">
                    {note.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full activity log (shown for non-narrative categories or as fallback) */}
        {!showSignupNarrative && !showOpenclawNarrative && report.activity_log?.length > 0 && (
          <ActivityLog
            entries={report.activity_log}
            filterWorkflows={activeCategoryWorkflows}
            isLive={isPartial}
            defaultCollapsed
          />
        )}

        {/* Checks heading */}
        <div className="mt-8 mb-3">
          <h3 className="text-sm font-semibold text-[#1A1A1A] uppercase tracking-wide">
            {(showOpenclawNarrative || (showSignupNarrative && signupData)) ? "Details" : "Checks"}
          </h3>
        </div>

        {/* 2-column check list or loading placeholder */}
        {activeChecks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-10">
            <div className="divide-y divide-[#F0EDE8]">
              {leftChecks.map((check, i) => (
                <CheckRow key={check.check_name} check={check} index={i} neutralDots={showOpenclawNarrative || (showSignupNarrative && !!signupData)} />
              ))}
            </div>
            <div className="divide-y divide-[#F0EDE8] border-t border-[#F0EDE8] lg:border-t-0">
              {rightChecks.map((check, i) => (
                <CheckRow key={check.check_name} check={check} index={midpoint + i} neutralDots={showOpenclawNarrative || (showSignupNarrative && !!signupData)} />
              ))}
            </div>
          </div>
        ) : activeCategoryLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#6B6B6B]">
            <Loader2 className="h-4 w-4 animate-spin text-[#FF6E00]" />
            <span>Running checks&hellip;</span>
          </div>
        ) : (
          <p className="text-sm text-[#6B6B6B] py-4">No checks available for this category.</p>
        )}
      </div>

      {/* Footer CTA */}
      <ReportCTA onScanAnother={onScanAnother} />
    </div>
  );
}
