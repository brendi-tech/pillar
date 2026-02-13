"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, UserPlus, Link2, Check, Info, AlertTriangle } from "lucide-react";
import { SessionReplay } from "@/components/AgentScore/SessionReplay";
import { cn } from "@/lib/utils";
import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import { CheckRow } from "./CheckRow";
import { ReportCTA } from "./ReportCTA";
import type {
  AgentScoreReport,
  CheckCategory,
  ScanNote,
} from "@/components/AgentScore/AgentScore.types";
import {
  ALL_CATEGORIES,
  SCORED_CATEGORIES,
  CATEGORY_LABELS,
  getCategoryScore,
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

  // Filter categories: only show signup_test tab when enabled
  const visibleCategories = useMemo(() => {
    return ALL_CATEGORIES.filter((cat) => {
      if (cat === "signup_test") return report.signup_test_enabled;
      return true;
    });
  }, [report.signup_test_enabled]);

  // Find the lowest-scoring *scored* category to select by default.
  // WebMCP is excluded — most sites score 0 there, so it's not a useful default.
  // null scores (all-DNF categories) are treated as Infinity so they don't
  // "win" lowest unless everything is null.
  const lowestCategory = useMemo(() => {
    const scoredVisible = visibleCategories.filter((c) =>
      SCORED_CATEGORIES.includes(c)
    );
    const candidates = scoredVisible.length > 0 ? scoredVisible : visibleCategories;
    let lowest: CheckCategory = candidates[0];
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
    useState<CheckCategory>(lowestCategory);

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

  // Token metrics for content tab
  const showTokenMetrics =
    activeCategory === "content" && report.token_metrics;

  // WebMCP CTA for webmcp tab
  const showWebMCPCta =
    activeCategory === "webmcp" && (report.webmcp_score === null || report.webmcp_score < 90);

  // Signup test narrative
  const showSignupNarrative = activeCategory === "signup_test";
  const signupOutcome = report.signup_test_data?.outcome as
    | Record<string, unknown>
    | undefined;
  const signupOutcomeType = signupOutcome?.outcome_type as string | undefined;
  const signupOutcomeDetail = signupOutcome?.detail as string | undefined;
  const hasSessionRecording = !!report.signup_test_data?.session_id;

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
          />
        </div>
        <div className="mt-4 flex justify-center">
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
        </div>
      </div>

      {/* Section 2: Category tab row */}
      <div className="mt-10">
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {visibleCategories.map((category) => {
            const score = getCategoryScore(report, category);
            const color = getScoreColor(score);
            const isActive = category === activeCategory;

            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "flex flex-col items-center px-4 py-3 rounded-xl border-2 transition-all cursor-pointer",
                  isActive
                    ? "bg-white shadow-md"
                    : "bg-transparent border-transparent hover:bg-white/60"
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
                />
                <span
                  className={cn(
                    "text-xs font-medium mt-1",
                    isActive ? "text-[#1A1A1A]" : "text-[#6B6B6B]"
                  )}
                >
                  {CATEGORY_LABELS[category]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Color legend */}
        <div className="flex items-center justify-center gap-6 mt-5 text-xs text-[#6B6B6B]">
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
      </div>

      {/* Section 3: Detail panel for active category */}
      <div className="mt-8 bg-white border border-[#D4D4D4] rounded-xl shadow-sm p-6 sm:p-10">
        {/* Category gauge (medium) */}
        <div className="flex justify-center">
          <ScoreGauge
            score={activeScore}
            size="md"
            label={CATEGORY_LABELS[activeCategory]}
          />
        </div>

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

        {/* Signup test narrative */}
        {showSignupNarrative && (
          <div className="mt-6 rounded-lg bg-[#F9F7F3] border border-[#E8E4DC] p-5">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="h-4 w-4 text-[#6B6B6B]" />
              <span className="text-sm font-semibold text-[#1A1A1A]">What happened</span>
            </div>
            <p className="text-sm text-[#6B6B6B] leading-relaxed">
              {signupOutcomeType === "success" &&
                "An AI agent found your signup page and created a test account successfully."}
              {signupOutcomeType === "verify_email" &&
                "An AI agent signed up and your site asked for email verification — that's a clear, agent-friendly outcome."}
              {signupOutcomeType === "captcha_blocked" &&
                "The agent found your signup form but was blocked by a CAPTCHA. AI agents can't solve CAPTCHAs."}
              {signupOutcomeType === "payment_required" &&
                "Signup requires payment information. Agents can't provide payment details."}
              {signupOutcomeType === "no_signup_found" &&
                "No signup or registration page was found on your site."}
              {signupOutcomeType === "form_error" &&
                (signupOutcomeDetail || "The form was submitted but returned an error.")}
              {signupOutcomeType === "redirect_unknown" &&
                (signupOutcomeDetail || "The agent was redirected but the outcome was unclear.")}
              {signupOutcomeType === "error" &&
                "The signup test encountered a technical error and could not complete."}
              {signupOutcomeType === "unknown" &&
                "The AI agent completed the signup flow but the outcome couldn't be clearly classified."}
              {!signupOutcomeType &&
                "The signup test could not determine what happened."}
            </p>
            {hasSessionRecording && (
              <SessionReplay
                reportId={report.id}
                instruction={report.signup_test_data?.instruction as string | undefined}
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

        {/* Checks heading */}
        <div className="mt-8 mb-3">
          <h3 className="text-sm font-semibold text-[#1A1A1A] uppercase tracking-wide">Checks</h3>
        </div>

        {/* 2-column check list */}
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-10">
          <div className="divide-y divide-[#F0EDE8]">
            {leftChecks.map((check, i) => (
              <CheckRow key={check.check_name} check={check} index={i} />
            ))}
          </div>
          <div className="divide-y divide-[#F0EDE8] border-t border-[#F0EDE8] lg:border-t-0">
            {rightChecks.map((check, i) => (
              <CheckRow key={check.check_name} check={check} index={midpoint + i} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <ReportCTA onScanAnother={onScanAnother} />
    </div>
  );
}
