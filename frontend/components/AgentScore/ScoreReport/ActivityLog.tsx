"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActivityLogEntry, ActivityLogLevel } from "../AgentScore.types";

// ── Workflow display config ────────────────────────────────────────────

const WORKFLOW_LABELS: Record<string, string> = {
  http_probes: "HTTP Probes",
  browser_analysis: "Browser Analysis",
  signup_test: "Signup Test",
  openclaw_test: "OpenClaw Test",
  analyze_and_score: "Scoring",
  finalize: "Finalization",
};

function getWorkflowLabel(workflow: string): string {
  return WORKFLOW_LABELS[workflow] ?? workflow;
}

// ── Level icon ─────────────────────────────────────────────────────────

function LevelIcon({ level }: { level: ActivityLogLevel }) {
  switch (level) {
    case "success":
      return <CheckCircle2 className="h-3.5 w-3.5 text-[#0CCE6B] shrink-0" />;
    case "error":
      return <AlertCircle className="h-3.5 w-3.5 text-[#FF4E42] shrink-0" />;
    case "warning":
      return (
        <AlertTriangle className="h-3.5 w-3.5 text-[#E68A00] shrink-0" />
      );
    default:
      return <Info className="h-3.5 w-3.5 text-[#9A9A9A] shrink-0" />;
  }
}

// ── Image URL detection ─────────────────────────────────────────────────

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)(\?.*)?$/i;

function isImageUrl(key: string, value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!key.toLowerCase().includes("screenshot")) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      IMAGE_EXTENSIONS.test(url.pathname)
    );
  } catch {
    return false;
  }
}

// ── Screenshot thumbnail with expand dialog ─────────────────────────────

function ScreenshotThumbnail({ url, label }: { url: string; label: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mt-1.5 rounded-md border border-[#E8E4DC] overflow-hidden hover:border-[#999] transition-colors cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="w-full max-w-[240px] h-auto"
          />
          <p className="text-[10px] text-[#999] px-2 py-1 text-center">
            Click to expand
          </p>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="w-full h-auto" />
      </DialogContent>
    </Dialog>
  );
}

// ── Detail renderer ────────────────────────────────────────────────────

function DetailView({ detail }: { detail: Record<string, unknown> }) {
  const entries = Object.entries(detail).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 ml-5.5 pl-3 border-l-2 border-[#E8E4DC] text-xs text-[#6B6B6B] space-y-1">
      {entries.map(([key, value]) =>
        isImageUrl(key, value) ? (
          <div key={key}>
            <span className="text-[#999] font-mono">{key}:</span>
            <ScreenshotThumbnail url={value} label={key.replace(/_/g, " ")} />
          </div>
        ) : (
          <div key={key} className="flex gap-2">
            <span className="text-[#999] font-mono shrink-0">{key}:</span>
            <span className="font-mono break-all">
              {typeof value === "object"
                ? JSON.stringify(value)
                : String(value)}
            </span>
          </div>
        )
      )}
    </div>
  );
}

// ── Single log row ─────────────────────────────────────────────────────

function LogRow({ entry }: { entry: ActivityLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail =
    entry.detail && Object.keys(entry.detail).length > 0;

  const relativeTime = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(entry.timestamp), {
        addSuffix: true,
      });
    } catch {
      return "";
    }
  }, [entry.timestamp]);

  return (
    <div>
      <button
        type="button"
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={cn(
          "w-full flex items-start gap-2 py-1.5 text-left group",
          hasDetail && "cursor-pointer hover:bg-[#F9F7F3] -mx-2 px-2 rounded"
        )}
      >
        <LevelIcon level={entry.level} />
        <span className="text-xs text-[#3A3A3A] flex-1 leading-relaxed">
          {entry.message}
        </span>
        <span className="text-[10px] text-[#999] shrink-0 pt-0.5 tabular-nums">
          {relativeTime}
        </span>
        {hasDetail && (
          <span className="text-[#999] shrink-0 pt-0.5">
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
      </button>
      {expanded && hasDetail && <DetailView detail={entry.detail} />}
    </div>
  );
}

// ── Workflow section (grouped entries) ──────────────────────────────────

function WorkflowSection({
  workflow,
  entries,
  isLive,
}: {
  workflow: string;
  entries: ActivityLogEntry[];
  isLive: boolean;
}) {
  const lastEntry = entries[entries.length - 1];
  const isRunning =
    isLive &&
    lastEntry &&
    lastEntry.level !== "success" &&
    lastEntry.level !== "error";

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {isRunning ? (
          <Loader2 className="h-3 w-3 text-[#FF6E00] animate-spin shrink-0" />
        ) : lastEntry?.level === "error" ? (
          <AlertCircle className="h-3 w-3 text-[#FF4E42] shrink-0" />
        ) : lastEntry?.level === "success" ? (
          <CheckCircle2 className="h-3 w-3 text-[#0CCE6B] shrink-0" />
        ) : (
          <div className="h-3 w-3 rounded-full bg-[#D4D4D4] shrink-0" />
        )}
        <span className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-wide">
          {getWorkflowLabel(workflow)}
        </span>
      </div>
      <div className="ml-5 space-y-0.5">
        {entries.map((entry, i) => (
          <LogRow key={`${entry.timestamp}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

interface ActivityLogProps {
  entries: ActivityLogEntry[];
  /** Filter to a specific workflow. If undefined, shows all. */
  filterWorkflow?: string;
  /** Filter to multiple workflows. Takes precedence over filterWorkflow. */
  filterWorkflows?: string[];
  /** Whether the scan is still running (shows spinners). */
  isLive?: boolean;
  /** Default collapsed state. */
  defaultCollapsed?: boolean;
}

export function ActivityLog({
  entries,
  filterWorkflow,
  filterWorkflows,
  isLive = false,
  defaultCollapsed = false,
}: ActivityLogProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(entries.length);

  // Filter entries if a workflow filter is provided
  const filteredEntries = useMemo(
    () =>
      filterWorkflows
        ? entries.filter((e) => filterWorkflows.includes(e.workflow))
        : filterWorkflow
          ? entries.filter((e) => e.workflow === filterWorkflow)
          : entries,
    [entries, filterWorkflow, filterWorkflows]
  );

  // Group entries by workflow (preserving order of first appearance)
  const groupedByWorkflow = useMemo(() => {
    const groups: { workflow: string; entries: ActivityLogEntry[] }[] = [];
    const seen = new Map<string, number>();

    for (const entry of filteredEntries) {
      const idx = seen.get(entry.workflow);
      if (idx !== undefined) {
        groups[idx].entries.push(entry);
      } else {
        seen.set(entry.workflow, groups.length);
        groups.push({ workflow: entry.workflow, entries: [entry] });
      }
    }
    return groups;
  }, [filteredEntries]);

  // Auto-scroll to bottom when new entries appear during live scan
  useEffect(() => {
    if (isLive && filteredEntries.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = filteredEntries.length;
  }, [filteredEntries.length, isLive]);

  if (filteredEntries.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-[#E8E4DC] bg-[#FDFCFA] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F9F7F3] transition-colors"
      >
        <span className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide flex items-center gap-2">
          {isLive && (
            <Loader2 className="h-3 w-3 text-[#FF6E00] animate-spin" />
          )}
          Activity Log
          <span className="text-[10px] font-normal text-[#999] lowercase tracking-normal">
            ({filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"})
          </span>
        </span>
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-[#999]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#999]" />
        )}
      </button>

      {/* Body */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="px-4 pb-3 max-h-80 overflow-y-auto space-y-3"
        >
          {groupedByWorkflow.map(({ workflow, entries: wfEntries }) => (
            <WorkflowSection
              key={workflow}
              workflow={workflow}
              entries={wfEntries}
              isLive={isLive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
