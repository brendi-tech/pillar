"use client";

import { Check, X, UserPlus } from "lucide-react";
import { ScoreGauge } from "@/components/AgentScore/ScoreGauge";
import { cn } from "@/lib/utils";
import type { AgentScoreReport } from "@/components/AgentScore/AgentScore.types";

interface SignupTestSectionProps {
  report: AgentScoreReport;
}

/**
 * Displays the agent signup test results in the report.
 *
 * Similar in structure to WebMCPSection — shown separately from the core
 * score with its own gauge and check list, plus a narrative of what happened.
 */
export function SignupTestSection({ report }: SignupTestSectionProps) {
  const score = report.signup_test_score ?? 0;
  const signupChecks = report.checks.filter((c) => c.category === "signup_test");
  const testData = report.signup_test_data || {};

  // Determine outcome narrative
  const outcome = (testData as Record<string, unknown>)?.outcome as
    | Record<string, unknown>
    | undefined;
  const outcomeType = outcome?.outcome_type as string | undefined;
  const outcomeDetail = outcome?.detail as string | undefined;

  const isGood = score >= 80;
  const isOk = score >= 50 && score < 80;

  return (
    <div className="relative border-2 border-dashed border-[#D4D4D4] rounded-xl p-6 sm:p-8 bg-[#FAFAF8]">
      {/* Badge */}
      <div className="absolute -top-3 left-5 px-3 py-0.5 text-xs font-semibold tracking-wider uppercase bg-[#F3EFE8] text-[#6B6B6B] border border-dashed border-[#D4D4D4] rounded-full flex items-center gap-1.5">
        <UserPlus className="h-3 w-3" />
        Agent Signup Test
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-6 mt-2">
        {/* Gauge */}
        <div className="shrink-0">
          <ScoreGauge score={score} size="sm" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-[#1A1A1A]">
            Agent Signup Flow
          </h3>

          {/* Narrative based on outcome */}
          <p className="text-sm text-[#6B6B6B] mt-2">
            {isGood && (
              <>An AI agent was able to find your signup page and create an account. Your registration flow is agent-friendly.</>
            )}
            {isOk && (
              <>An AI agent found your signup page but encountered friction during registration. {outcomeDetail || "Some steps could not be completed."}</>
            )}
            {!isGood && !isOk && outcomeType === "no_signup_found" && (
              <>No signup or registration page was found on your site. Ensure your signup link is visible in the navigation or as a prominent call-to-action.</>
            )}
            {!isGood && !isOk && outcomeType === "captcha_blocked" && (
              <>Your signup form is blocked by a CAPTCHA. AI agents cannot solve CAPTCHAs — this is a hard blocker for agent-driven account creation.</>
            )}
            {!isGood && !isOk && outcomeType === "payment_required" && (
              <>Signup requires payment information. Agents cannot provide payment details. Consider offering a free tier or trial that doesn&apos;t require payment at signup.</>
            )}
            {!isGood && !isOk && outcomeType === "error" && (
              <>The signup test encountered a technical error and could not complete. This doesn&apos;t reflect your site&apos;s signup experience.</>
            )}
            {!isGood && !isOk && !outcomeType && (
              <>We attempted to sign up for your site as an AI agent. The signup flow could not be completed.</>
            )}
            {!isGood && !isOk && outcomeType && !["no_signup_found", "captcha_blocked", "payment_required", "error"].includes(outcomeType) && (
              <>{outcomeDetail || "The signup flow could not be completed by the agent."}</>
            )}
          </p>
        </div>
      </div>

      {/* Check list */}
      {signupChecks.length > 0 && (
        <div className="mt-6 space-y-2">
          {signupChecks.map((check) => (
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
