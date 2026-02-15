"use client";

import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentScoreCheck } from "@/components/AgentScore/AgentScore.types";
import { CHECK_TOOLTIPS } from "./CheckRow.tooltips";

interface CheckRowProps {
  check: AgentScoreCheck;
  index: number;
  /** When true, use neutral styling (no red/green) — the score isn't derived from these checks. */
  neutralDots?: boolean;
}

/**
 * Format check details into a short, human-readable string.
 * Every check_name should have an explicit case to avoid
 * the verbose generic fallback.
 */
function formatDetails(check: AgentScoreCheck): string | null {
  if (check.status === "dnf") return "Could not run";

  const d = check.details;
  if (!d || Object.keys(d).length === 0) return null;

  switch (check.check_name) {
    // ── Content / Discovery ──────────────────────────────────────────────

    case "llms_txt_present":
      if (d.exists && d.size_bytes) {
        return `Valid ${d.is_markdown ? "markdown" : "text"}, ${formatBytes(d.size_bytes as number)}`;
      }
      return d.exists ? "Found" : "Not found";

    case "structured_data": {
      const types = d.schema_types as string[] | undefined;
      if (types && Array.isArray(types) && types.length > 0) {
        return types.length <= 3 ? types.join(", ") : `${types.length} types`;
      }
      const blocks = d.valid_blocks ?? d.json_ld_blocks;
      return `${blocks ?? 0}`;
    }

    case "sitemap_present":
      return d.exists ? "Found" : "Not found";

    case "meta_description": {
      const parts: string[] = [];
      if (d.description_length !== undefined && (d.description_length as number) > 0) {
        parts.push(`${d.description_length} chars`);
      }
      if (d.has_og_tags) parts.push("has OG tags");
      return parts.length > 0 ? parts.join(", ") : "Missing";
    }

    case "semantic_headings":
      if (d.h1_count !== undefined) {
        return `h1: ${d.h1_count}, ${d.heading_count ?? 0} total`;
      }
      return null;

    case "canonical_url": {
      if (d.canonical_url && typeof d.canonical_url === "string") {
        const url = d.canonical_url as string;
        try {
          const parsed = new URL(url);
          return parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
        } catch {
          return url.length > 40 ? url.slice(0, 37) + "…" : url;
        }
      }
      return d.has_canonical ? "Found" : "Missing";
    }

    // ── Content / Readability ────────────────────────────────────────────

    case "markdown_content_negotiation":
      if (d.supports_markdown) {
        const reduction = d.token_reduction_percent;
        return reduction
          ? `${Math.round(reduction as number)}% token reduction`
          : "Supported";
      }
      return "Not supported";

    case "token_efficiency":
      if (d.html_tokens && d.content_tokens) {
        const ratio = ((d.content_tokens as number) / (d.html_tokens as number) * 100).toFixed(0);
        return `${ratio}% content ratio`;
      }
      return null;

    case "markdown_available":
      if (d.llms_txt_available) return "Available";
      if (d.has_content_negotiation) return "Via content negotiation";
      return "Not available";

    case "content_extraction": {
      const hasMain = d.has_main_content_area;
      const mdLen = d.extracted_markdown_length as number | undefined;
      if (hasMain && mdLen) {
        return `Has <main>, ${formatTokenCount(mdLen)} chars`;
      }
      if (hasMain) return "Has <main>";
      if (mdLen) return `${formatTokenCount(mdLen)} chars extracted`;
      return "No <main> element";
    }

    case "semantic_html": {
      const count = d.semantic_element_count as number | undefined;
      if (count !== undefined) {
        return `${count}`;
      }
      return null;
    }

    case "low_token_bloat": {
      const effective = d.effective_tokens as number | undefined;
      const html = d.html_tokens as number | undefined;
      const tokens = effective ?? html;
      if (!tokens) return null;
      const label = d.using_markdown_tokens ? "effective" : "HTML";
      return `${formatTokenCount(tokens)} ${label} tokens`;
    }

    // ── Content / Permissions ────────────────────────────────────────────

    case "robots_txt_ai": {
      if (!d.robots_txt_exists && d.robots_txt_exists !== undefined) return "No robots.txt";
      if (!d.robots_txt_exists && d.message) return String(d.message).slice(0, 40);
      const blocked = d.blocked_count as number | undefined;
      if (blocked !== undefined) {
        return blocked === 0 ? "All AI crawlers allowed" : `${blocked} crawlers blocked`;
      }
      return d.robots_txt_exists ? "Found" : "No robots.txt";
    }

    case "content_signal_header":
      if (d.has_content_signal && d.raw_header) {
        return String(d.raw_header);
      }
      return d.has_content_signal ? "Found" : "No header";

    // ── Interaction / Accessibility ──────────────────────────────────────

    case "aria_labels":
      if (d.total_unlabeled_elements !== undefined) {
        return (d.total_unlabeled_elements as number) === 0
          ? "All labeled"
          : `${d.total_unlabeled_elements} unlabeled`;
      }
      return null;

    case "landmark_roles": {
      const total = d.total_landmarks as number | undefined;
      if (total !== undefined) {
        if (total === 0) return "None found";
        const parts: string[] = [`${total} landmarks`];
        if (d.has_main) parts.push("has main");
        return parts.join(", ");
      }
      return null;
    }

    case "keyboard_focusable": {
      const issues = d.total_issues as number | undefined;
      if (issues !== undefined) {
        return issues === 0 ? "No issues" : `${issues} issues`;
      }
      return null;
    }

    case "consistent_nav": {
      const navs = d.nav_landmarks as unknown[] | undefined;
      if (navs !== undefined) {
        if (navs.length === 0) return "No nav elements";
        return d.has_named_nav ? `${navs.length} named navs` : `${navs.length} navs`;
      }
      return null;
    }

    // ── Interaction / Interactability ────────────────────────────────────

    case "labeled_forms":
      if (d.form_count !== undefined) {
        if ((d.form_count as number) === 0) return "No forms detected";
        return `${d.labeled_inputs}/${d.total_inputs} inputs labeled`;
      }
      return null;

    case "semantic_actions": {
      const generic = d.generic_actions as number | undefined;
      if (generic !== undefined) {
        return generic === 0 ? "All descriptive" : `${generic} generic labels`;
      }
      return null;
    }

    case "api_documentation": {
      const hasMcp = d.has_mcp_endpoint || d.has_mcp_link_in_page;
      const hasApi = d.has_api_link_in_page;
      if (hasMcp && hasApi) return "MCP + API docs found";
      if (hasMcp) return "MCP found";
      if (hasApi) return "API docs found";
      return "Not found";
    }

    // ── WebMCP ───────────────────────────────────────────────────────────

    case "webmcp_meta_tag":
      return d.has_webmcp_meta || d.has_model_context_meta ? "Found" : "Not found";

    case "webmcp_script_detected": {
      const refs = d.references_found as number | undefined;
      if (refs !== undefined) {
        return refs > 0 ? `${refs} references` : "None found";
      }
      return null;
    }

    case "tools_registered":
      if (d.tool_count !== undefined && (d.tool_count as number) > 0) {
        return `${d.tool_count} tools`;
      }
      return d.api_exists ? "API exists, no tools" : "None";

    case "tool_descriptions_quality": {
      const descCov = d.description_coverage as number | undefined;
      const schemaCov = d.schema_coverage as number | undefined;
      if (descCov !== undefined && schemaCov !== undefined) {
        return `${descCov}% described, ${schemaCov}% schemas`;
      }
      return null;
    }

    case "tool_count":
      return d.tool_count !== undefined ? `${d.tool_count} tools` : null;

    case "context_provided":
      return d.context_provided ? "Active" : "Not used";

    // ── Signup Test ─────────────────────────────────────────────────────

    case "signup_page_discoverable":
      return d.found ? "Found" : "Not found";

    case "signup_form_parseable":
      return d.form_found ? "Parseable" : "Not found";

    case "signup_fields_labeled":
      return d.fields_identifiable ? "All identifiable" : "Issues found";

    case "signup_no_captcha":
      return d.captcha_detected ? "CAPTCHA detected" : "No CAPTCHA";

    case "signup_submission_succeeds":
      return d.submitted ? "Succeeded" : (d.outcome_type as string) ?? "Failed";

    case "signup_clear_outcome":
      return d.outcome_clear ? "Clear" : "Unclear";

    // ── Fallback (handles checks added after this code was written) ─────

    default: {
      // Common patterns: exists/found checks
      if (d.exists !== undefined) return d.exists ? "Found" : "Not found";
      // Count-based checks
      const count = d.count ?? d.total;
      if (count !== undefined) return `${count}`;
      // Single scalar value
      const vals = Object.entries(d)
        .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
        .map(([, v]) => String(v));
      if (vals.length === 1) return vals[0];
      return null;
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatTokenCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function getDotColor(check: AgentScoreCheck): string {
  if (check.status === "dnf") return "#9A9A9A";
  if (check.passed) return "#0CCE6B";
  if (check.score >= 50) return "#FFA400";
  return "#FF4E42";
}

export function CheckRow({ check, index, neutralDots }: CheckRowProps) {
  const details = formatDetails(check);
  const isDnf = check.status === "dnf";
  const isExpandable = (!check.passed || isDnf) && !!check.recommendation;
  const rightValue = details ?? String(check.score);
  const tooltip = CHECK_TOOLTIPS[check.check_name];

  const animStyle = {
    animationDelay: `${index * 30}ms`,
    animationFillMode: "forwards" as const,
  };

  const rowInner = (
    <div
      className={cn(
        "flex items-center gap-3 py-2",
        isExpandable && "cursor-pointer [&[data-state=open]_.check-chevron]:rotate-180"
      )}
    >
      {/* Colored dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: neutralDots ? (check.passed ? "#A0AEC0" : "#CBD5E0") : getDotColor(check) }}
      />

      {/* Label + info tooltip */}
      <span className="text-sm text-[#1A1A1A] flex-1 min-w-0 flex items-center gap-1.5">
        <span className="truncate">{check.check_label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="inline-flex shrink-0 text-[#B0B0B0] hover:text-[#6B6B6B] transition-colors"
                aria-label={`Why "${check.check_label}" matters`}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-xs text-left leading-relaxed"
            >
              <p>{tooltip.description}</p>
              {tooltip.link && (
                <a
                  href={tooltip.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[10px] underline opacity-70 hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {tooltip.linkLabel ?? "Learn more"} →
                </a>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </span>

      {/* Right-aligned detail value */}
      <span
        className={cn(
          "text-xs tabular-nums shrink-0 text-right truncate max-w-[45%]",
          neutralDots
            ? "text-[#6B6B6B]"
            : isDnf
              ? "text-[#9A9A9A]"
              : check.passed
                ? "text-[#6B6B6B]"
                : "text-[#FF4E42]"
        )}
        title={rightValue}
      >
        {rightValue}
      </span>

      {/* Expand chevron for failed checks */}
      {isExpandable && (
        <ChevronDown className="check-chevron h-3.5 w-3.5 text-[#9A9A9A] shrink-0 transition-transform duration-200" />
      )}
    </div>
  );

  if (!isExpandable) {
    return (
      <div className="opacity-0 animate-fade-in-up" style={animStyle}>
        {rowInner}
      </div>
    );
  }

  return (
    <Collapsible
      className="opacity-0 animate-fade-in-up"
      style={animStyle}
    >
      <CollapsibleTrigger asChild className="w-full">
        {rowInner}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className={cn(
          "text-sm leading-relaxed pl-5 pb-2",
          isDnf ? "text-[#9A9A9A]" : "text-[#FF6E00]"
        )}>
          {check.recommendation}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
