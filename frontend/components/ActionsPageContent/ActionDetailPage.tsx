"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DetailHeader,
  DetailPageShell,
  MetadataStrip,
  SectionLabel,
  TimestampFooter,
} from "@/components/shared";
import type { MetadataItem } from "@/components/shared";
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
        description: "Handler implemented and confirmed working.",
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
 * Single-column layout using shared detail page components.
 */
export function ActionDetailPage({ actionId }: ActionDetailPageProps) {
  const {
    data: action,
    isLoading,
    error,
    refetch,
  } = useQuery(actionDetailQuery(actionId));

  const actionIconName = action
    ? getActionTypeIcon(action.action_type)
    : undefined;
  const ActionIcon = actionIconName
    ? ICON_COMPONENTS[actionIconName] || Zap
    : Zap;
  const implStatus = action
    ? getImplementationStatusDisplay(action.implementation_status)
    : undefined;

  // Build metadata items for the strip
  const metadataItems: MetadataItem[] = [];
  if (action) {
    if (action.action_type === "navigate" && action.path_template) {
      metadataItems.push({
        label: "Path",
        value: (
          <code className="truncate rounded bg-muted px-2 py-0.5 text-xs">
            {action.path_template}
          </code>
        ),
        colSpan: 2,
      });
    }
    if (action.action_type === "external_link" && action.external_url) {
      metadataItems.push({
        label: "URL",
        value: (
          <code className="truncate rounded bg-muted px-2 py-0.5 text-xs">
            {action.external_url}
          </code>
        ),
        colSpan: 2,
      });
    }
  }

  return (
    <DetailPageShell
      isLoading={isLoading}
      error={error ?? null}
      isEmpty={!action && !isLoading && !error}
      emptyTitle="Action not found"
      emptyDescription="Select an action from the sidebar to view its details."
      onRetry={refetch}
    >
      {action && implStatus && (
        <>
          {/* ── Header ── */}
          <DetailHeader
            title={deriveActionLabel(action.name)}
            subtitle={action.name}
            subtitleMono
            badges={
              <>
                <Badge
                  variant={
                    action.status === "published" ? "default" : "secondary"
                  }
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
                  <Badge variant="outline" className="text-muted-foreground">
                    No embedding
                  </Badge>
                )}
              </>
            }
          />

          {/* ── Code-First Notice ── */}
          <Alert className="max-w-prose">
            <Code2 className="h-4 w-4" />
            <AlertTitle>Code-First Action</AlertTitle>
            <AlertDescription>
              Defined in client code. Update the action definition in your
              codebase and deploy to sync changes.
            </AlertDescription>
          </Alert>

          {/* ── Metadata Row ── */}
          {metadataItems.length > 0 && (
            <MetadataStrip items={metadataItems} />
          )}

          {/* ── Execution Flags ── */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
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

          {/* ── Description ── */}
          <div>
            <SectionLabel>Description</SectionLabel>
            <p className="max-w-prose text-sm leading-relaxed">
              {action.description}
            </p>
          </div>

          {/* ── Examples ── */}
          {action.examples && action.examples.length > 0 && (
            <div>
              <SectionLabel
                className="mb-2"
                annotation={
                  <>&mdash; improve search ranking, not seen by the AI</>
                }
              >
                Example Phrases
              </SectionLabel>
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
              <CardTitle className="text-sm">
                Implementation & Statistics
              </CardTitle>
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
                      {
                        IMPLEMENTATION_STATUS_LABELS[
                          action.implementation_status
                        ]
                      }
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
                  <dd className="font-medium tabular-nums">
                    {action.execution_count}
                  </dd>
                </div>
                {action.status === "published" && (
                  <>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Successes
                      </dt>
                      <dd className="font-medium tabular-nums text-emerald-600">
                        {action.confirmation_success_count}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Failures
                      </dt>
                      <dd className="font-medium tabular-nums text-red-600">
                        {action.confirmation_failure_count}
                      </dd>
                    </div>
                  </>
                )}
                {action.last_executed_at && (
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Last executed
                    </dt>
                    <dd className="font-medium">
                      {formatDistanceToNow(new Date(action.last_executed_at), {
                        addSuffix: true,
                      })}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Timestamps footer */}
              <TimestampFooter
                createdAt={action.created_at}
                updatedAt={action.updated_at}
                extras={
                  action.last_confirmed_at
                    ? [
                        {
                          label: "Confirmed",
                          date: action.last_confirmed_at,
                        },
                      ]
                    : undefined
                }
              />
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
        </>
      )}
    </DetailPageShell>
  );
}
