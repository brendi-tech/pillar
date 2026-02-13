/**
 * Types for the Agent Readiness Score tool.
 * Matches the backend API response shape from /api/public/agent-score/.
 */

export type ReportStatus = "pending" | "running" | "complete" | "failed";

export type CheckCategory =
  | "content"
  | "interaction"
  | "webmcp"
  | "signup_test";

export type CheckStatus = "evaluated" | "dnf";

export interface TokenMetrics {
  html_token_count: number | null;
  markdown_token_count: number | null;
  content_token_count: number | null;
  supports_markdown_negotiation: boolean;
  token_reduction_percent: number | null;
  content_signal: string | null;
}

export interface AgentScoreCheck {
  category: CheckCategory;
  check_name: string;
  check_label: string;
  passed: boolean;
  score: number;
  status: CheckStatus;
  details: Record<string, unknown>;
  recommendation: string;
}

export type ScanNoteType = "info" | "warning";

export interface ScanNote {
  type: ScanNoteType;
  category: CheckCategory | null;
  title: string;
  detail: string;
}

export interface ScanProgress {
  http_probes_done: boolean;
  browser_analysis_done: boolean;
  analyzers_done: boolean;
  signup_test_done: boolean;
  signup_test_status: string;
  scoring_done: boolean;
}

export interface AgentScoreReport {
  id: string;
  url: string;
  domain: string;
  status: ReportStatus;
  overall_score: number | null;
  content_score: number | null;
  interaction_score: number | null;
  webmcp_score: number | null;
  signup_test_enabled: boolean;
  signup_test_score: number | null;
  signup_test_data: Record<string, unknown>;
  token_metrics: TokenMetrics;
  screenshot_url: string | null;
  checks: AgentScoreCheck[];
  progress: ScanProgress;
  scan_notes: ScanNote[];
  error_message: string;
  created_at: string;
}

export interface ScanResponse {
  report_id: string;
  status: ReportStatus;
}

/** All 4 unified categories. WebMCP is last — it's scored independently
 *  and excluded from the overall score. */
export const ALL_CATEGORIES: CheckCategory[] = [
  "content",
  "interaction",
  "signup_test",
  "webmcp",
];

/** Categories that contribute to the overall score. */
export const SCORED_CATEGORIES: CheckCategory[] = [
  "content",
  "interaction",
  "signup_test",
];

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  content: "Content",
  interaction: "Interaction",
  webmcp: "WebMCP (Beta)",
  signup_test: "Signup Test",
};

export const CATEGORY_DESCRIPTIONS: Record<CheckCategory, string> = {
  content: "Can agents find, read, and access your content?",
  interaction: "Can agents take actions and navigate your site?",
  webmcp: "Does your site expose tools for AI agents?",
  signup_test: "Can an AI agent create an account on your site?",
};

/** Get the category score field name from a category. */
export function getCategoryScore(
  report: AgentScoreReport,
  category: CheckCategory
): number | null {
  const key = `${category}_score` as keyof AgentScoreReport;
  const value = report[key];
  if (value === null || value === undefined) return null;
  return value as number;
}
