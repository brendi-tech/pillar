"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { actionDetailQuery } from "@/queries/actions.queries";
import type { ImplementationStatus } from "@/types/actions";
import {
  ACTION_TYPE_LABELS,
  IMPLEMENTATION_STATUS_LABELS,
  deriveActionLabel,
  getActionTypeIcon,
} from "@/types/actions";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Layout,
  LayoutPanelLeft,
  Pencil,
  PlayCircle,
  RefreshCw,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";

interface ActionDetailPageProps {
  actionId: string;
}

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  "arrow-right": ArrowRight,
  layout: Layout,
  "edit-3": Pencil,
  zap: Zap,
  database: Database,
  copy: Copy,
  "external-link": ExternalLink,
  "play-circle": PlayCircle,
  "layout-panel-left": LayoutPanelLeft,
};

function getImplementationStatusDisplay(status: ImplementationStatus) {
  switch (status) {
    case "verified":
      return {
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        description:
          "Handler implemented and confirmed working.",
      };
    case "failing":
      return {
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        icon: <XCircle className="h-3.5 w-3.5" />,
        description: "Last execution reported a failure.",
      };
    case "stale":
      return {
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        icon: <Clock className="h-3.5 w-3.5" />,
        description: "No confirmations in the last 30 days.",
      };
    default:
      return {
        className:
          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        icon: <CircleHelp className="h-3.5 w-3.5" />,
        description: "No execution confirmations received yet.",
      };
  }
}

/**
 * Action Detail Page - Read-Only View
 *
 * Single-column layout optimized for the constrained detail panel.
 * All action metadata is visible without scrolling through card chrome.
 */
export function ActionDetailPage({ actionId }: ActionDetailPageProps) {
  const {
    data: action,
    isLoading,
    error,
    refetch,
  } = useQuery(actionDetailQuery(actionId));

  if (isLoading) {
    return (
      <div className="h-full overflow-auto">
        <div className="space-y-4 p-6">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-px bg-border" />
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 py-12">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-medium">Failed to load action</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="flex flex-col items-center justify-center p-6 py-12">
        <h3 className="text-lg font-medium">Action not found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Select an action from the sidebar to view its details.
        </p>
      </div>
    );
  }

  const actionIconName = getActionTypeIcon(action.action_type);
  const ActionIcon = ICON_COMPONENTS[actionIconName] || Zap;
  const implStatus = getImplementationStatusDisplay(action.implementation_status);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {/* ── Header ── */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">
                {deriveActionLabel(action.name)}
              </h1>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {action.name}
              </p>
            </div>
          </div>

          {/* Inline badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant={action.status === "published" ? "default" : "secondary"}
            >
              {action.status}
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <ActionIcon className="h-3 w-3" />
              {ACTION_TYPE_LABELS[action.action_type]}
            </Badge>
            {action.has_embedding && (
              <Badge
                variant="outline"
                className="text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
              >
                Embedded
              </Badge>
            )}
            {!action.has_embedding && (
              <Badge
                variant="outline"
                className="text-muted-foreground"
              >
                No embedding
              </Badge>
            )}
          </div>
        </div>

        {/* ── Code-First Notice ── */}
        <Alert>
          <Code2 className="h-4 w-4" />
          <AlertTitle>Code-First Action</AlertTitle>
          <AlertDescription>
            Defined in client code. Update the action definition in your
            codebase and deploy to sync changes.
          </AlertDescription>
        </Alert>

        {/* ── Metadata Row ── */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            {/* Path / URL */}
            {action.action_type === "navigate" && action.path_template && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-muted-foreground">Path</span>
                <code className="truncate rounded bg-muted px-2 py-0.5 text-xs">
                  {action.path_template}
                </code>
              </div>
            )}
            {action.action_type === "external_link" && action.external_url && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-muted-foreground">URL</span>
                <code className="truncate rounded bg-muted px-2 py-0.5 text-xs">
                  {action.external_url}
                </code>
              </div>
            )}

            {/* Execution flags */}
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 text-xs ${action.auto_run ? "text-foreground" : "text-muted-foreground/50"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${action.auto_run ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                />
                Auto-run
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs ${action.auto_complete ? "text-foreground" : "text-muted-foreground/50"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${action.auto_complete ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                />
                Auto-complete
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs ${action.returns_data ? "text-foreground" : "text-muted-foreground/50"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${action.returns_data ? "bg-blue-500" : "bg-muted-foreground/30"}`}
                />
                Returns data
              </span>
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        <div>
          <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Description
          </h3>
          <p className="text-sm leading-relaxed">{action.description}</p>
        </div>

        {/* ── Examples ── */}
        {action.examples && action.examples.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Example Phrases
              <span className="ml-1.5 font-normal normal-case tracking-normal">
                &mdash; improve search ranking, not seen by the AI
              </span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {action.examples.map((example, i) => (
                <span
                  key={i}
                  className="inline-block rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {example}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Data Schema ── */}
        {action.data_schema &&
          Object.keys(action.data_schema).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Data Schema</CardTitle>
                <CardDescription>
                  Parameters the AI extracts from user messages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(action.data_schema, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

        {/* ── Default Data ── */}
        {action.default_data &&
          Object.keys(action.default_data).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Default Data</CardTitle>
                <CardDescription>
                  Fallback values when the AI doesn&apos;t extract specifics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(action.default_data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

        {/* ── Parameter Examples ── */}
        {action.parameter_examples &&
          action.parameter_examples.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Parameter Examples</CardTitle>
                <CardDescription>
                  Example parameter sets for this action
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {action.parameter_examples.map((example, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    {example.description && (
                      <div className="mb-2 text-xs font-medium">
                        {example.description}
                      </div>
                    )}
                    <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(example.parameters, null, 2)}
                    </pre>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        {/* ── Required Context ── */}
        {action.required_context &&
          Object.keys(action.required_context).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Required Context</CardTitle>
                <CardDescription>
                  Only surfaces when user context matches these requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(action.required_context, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

        {/* ── Implementation & Statistics (merged) ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Implementation & Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Implementation status row */}
            {action.status === "published" && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    className={`flex items-center gap-1 ${implStatus.className}`}
                  >
                    {implStatus.icon}
                    {IMPLEMENTATION_STATUS_LABELS[action.implementation_status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {implStatus.description}
                  </span>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Executions</dt>
                <dd className="font-medium tabular-nums">{action.execution_count}</dd>
              </div>
              {action.status === "published" && (
                <>
                  <div>
                    <dt className="text-xs text-muted-foreground">Successes</dt>
                    <dd className="font-medium tabular-nums text-emerald-600">
                      {action.confirmation_success_count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Failures</dt>
                    <dd className="font-medium tabular-nums text-red-600">
                      {action.confirmation_failure_count}
                    </dd>
                  </div>
                </>
              )}
              {action.last_executed_at && (
                <div>
                  <dt className="text-xs text-muted-foreground">Last executed</dt>
                  <dd className="font-medium">
                    {formatDistanceToNow(new Date(action.last_executed_at), {
                      addSuffix: true,
                    })}
                  </dd>
                </div>
              )}
            </dl>

            {/* Timestamps footer */}
            <Separator />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>
                Created{" "}
                {formatDistanceToNow(new Date(action.created_at), {
                  addSuffix: true,
                })}
              </span>
              <span>
                Updated{" "}
                {formatDistanceToNow(new Date(action.updated_at), {
                  addSuffix: true,
                })}
              </span>
              {action.last_confirmed_at && (
                <span>
                  Confirmed{" "}
                  {formatDistanceToNow(new Date(action.last_confirmed_at), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── SDK Handler ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">SDK Handler</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
              {`pillar.onAction('${action.name}', (data) => {\n  // Your handler code\n});`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
