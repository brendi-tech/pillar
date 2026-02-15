/**
 * Types for the Agent Readiness Score tool.
 * Matches the backend API response shape from /api/public/agent-score/.
 *
 * Category metadata (labels, descriptions, sort order, scored-ness) is now
 * returned by the API in `category_config` so the frontend renders
 * dynamically.  DEFAULT_CATEGORY_CONFIG is the static fallback used for
 * the pre-scan preview (before any report is loaded).
 */

export type ReportStatus = "pending" | "running" | "complete" | "failed";

export type CheckCategory = string;

export type CheckStatus = "evaluated" | "dnf";

// ── Category config (from backend CATEGORY_REGISTRY) ────────────────────

export interface CategoryConfig {
  label: string;
  description: string;
  scored: boolean;
  optional: boolean;
  sort_order: number;
}

export type CategoryConfigMap = Record<string, CategoryConfig>;

// ── Token metrics ───────────────────────────────────────────────────────

export interface TokenMetrics {
  html_token_count: number | null;
  markdown_token_count: number | null;
  content_token_count: number | null;
  supports_markdown_negotiation: boolean;
  token_reduction_percent: number | null;
  content_signal: string | null;
}

// ── Check result ────────────────────────────────────────────────────────

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

// ── Scan notes ──────────────────────────────────────────────────────────

export type ScanNoteType = "info" | "warning";

export interface ScanNote {
  type: ScanNoteType;
  category: CheckCategory | null;
  title: string;
  detail: string;
}

// ── OpenClaw data ───────────────────────────────────────────────────────

export interface OpenclawTaskTried {
  task: string;
  succeeded: boolean;
  detail: string;
}


export interface OpenclawData {
  score: number | null;
  summary: string;
  what_worked: string[];
  what_didnt: string[];
  mcp_found: boolean;
  mcp_usable: boolean;
  signup_attempted: boolean;
  signup_succeeded: boolean;
  tasks_tried: OpenclawTaskTried[];
  error?: string;
}

// ── Activity log ────────────────────────────────────────────────────────

export type ActivityLogLevel = "info" | "warning" | "error" | "success";

export interface ActivityLogEntry {
  timestamp: string;
  workflow: string;
  level: ActivityLogLevel;
  message: string;
  detail: Record<string, unknown>;
}

// ── Scan progress ───────────────────────────────────────────────────────

/** Per-layer state computed by the serializer — single source of truth. */
export type LayerState = "disabled" | "running" | "success" | "error";

export interface ScanProgress {
  http_probes_done: boolean;
  browser_analysis_done: boolean;
  analyzers_done: boolean;
  signup_test_done: boolean;
  signup_test_state: LayerState;
  signup_test_status: string;
  openclaw_test_done: boolean;
  openclaw_test_state: LayerState;
  openclaw_test_status: string;
  scoring_done: boolean;
}

// ── Report ──────────────────────────────────────────────────────────────

export interface AgentScoreReport {
  id: string;
  url: string;
  domain: string;
  status: ReportStatus;
  overall_score: number | null;

  /** Config-driven category scores map, e.g. {"content": 85, "interaction": 72} */
  category_scores: Record<string, number | null>;
  /** Category registry from the backend — drives all frontend rendering */
  category_config: CategoryConfigMap;

  // Legacy per-category score fields (kept for backward compat with old reports)
  content_score: number | null;
  interaction_score: number | null;
  webmcp_score: number | null;
  signup_test_enabled: boolean;
  signup_test_score: number | null;
  signup_test_data: Record<string, unknown>;
  openclaw_test_enabled: boolean;
  openclaw_data: OpenclawData;
  token_metrics: TokenMetrics;
  screenshot_url: string | null;
  checks: AgentScoreCheck[];
  activity_log: ActivityLogEntry[];
  progress: ScanProgress;
  scan_notes: ScanNote[];
  error_message: string;
  created_at: string;
}

export interface ScanResponse {
  report_id: string;
  status: ReportStatus;
}

// ── Static fallback config ──────────────────────────────────────────────
// Used for the pre-scan preview (before any report is loaded).
// Mirrors the backend CATEGORY_REGISTRY.

export const DEFAULT_CATEGORY_CONFIG: CategoryConfigMap = {
  content: {
    label: "Content",
    description: "Can agents find, read, and access your content?",
    scored: true,
    optional: false,
    sort_order: 1,
  },
  interaction: {
    label: "Interaction",
    description: "Can agents take actions and navigate your site?",
    scored: true,
    optional: false,
    sort_order: 2,
  },
  signup_test: {
    label: "Signup Test",
    description: "Can an AI agent create an account on your site?",
    scored: true,
    optional: true,
    sort_order: 3,
  },
  webmcp: {
    label: "WebMCP (Beta)",
    description: "Does your site expose tools for AI agents?",
    scored: false,
    optional: false,
    sort_order: 4,
  },
  openclaw: {
    label: "Agent Experience",
    description: "What happened when a real AI agent tried to use your site?",
    scored: true,
    optional: true,
    sort_order: 5,
  },
};

// ── Helper functions (derived from report.category_config) ──────────────

/** Get the category config map from a report, with fallback for old reports. */
export function getReportCategoryConfig(report: AgentScoreReport): CategoryConfigMap {
  if (report.category_config && Object.keys(report.category_config).length > 0) {
    return report.category_config;
  }
  return DEFAULT_CATEGORY_CONFIG;
}

/** Categories sorted by sort_order, filtered to those present in the report. */
export function getVisibleCategories(report: AgentScoreReport): string[] {
  const config = getReportCategoryConfig(report);
  return Object.entries(config)
    .filter(([key, cfg]) => {
      // Hide optional categories that weren't enabled for this scan
      if (cfg.optional && key === "signup_test") return report.signup_test_enabled;
      if (cfg.optional && key === "openclaw") return report.openclaw_test_enabled;
      // While the report is still running, show all non-optional categories
      // as loading placeholders even before analyze-and-score populates them.
      // Only hide categories with no data on *completed* reports (e.g. new
      // category on old report).
      if (report.status !== "complete" && report.status !== "failed") return true;
      const hasChecks = report.checks.some((c) => c.category === key);
      const hasScore = getCategoryScore(report, key) !== null;
      if (!cfg.optional && !hasChecks && !hasScore) return false;
      return true;
    })
    .sort((a, b) => a[1].sort_order - b[1].sort_order)
    .map(([key]) => key);
}

/** Categories that contribute to the overall score. */
export function getScoredCategories(report: AgentScoreReport): string[] {
  const config = getReportCategoryConfig(report);
  return Object.entries(config)
    .filter(([, cfg]) => cfg.scored)
    .map(([key]) => key);
}

/** Get the score for a category from the report. */
export function getCategoryScore(
  report: AgentScoreReport,
  category: string
): number | null {
  // Prefer the new category_scores map
  if (report.category_scores && category in report.category_scores) {
    const val = report.category_scores[category];
    return val ?? null;
  }
  // Fall back to legacy individual columns for old reports
  const key = `${category}_score` as keyof AgentScoreReport;
  const value = report[key];
  if (value === null || value === undefined) return null;
  return value as number;
}

/** Get the label for a category. */
export function getCategoryLabel(
  report: AgentScoreReport,
  category: string
): string {
  const config = getReportCategoryConfig(report);
  return config[category]?.label ?? category;
}

/** Get the description for a category. */
export function getCategoryDescription(
  report: AgentScoreReport,
  category: string
): string {
  const config = getReportCategoryConfig(report);
  return config[category]?.description ?? "";
}

/** Check if a category is excluded from the overall score. */
export function isUnscoredCategory(
  report: AgentScoreReport,
  category: string
): boolean {
  const config = getReportCategoryConfig(report);
  return !(config[category]?.scored ?? true);
}
