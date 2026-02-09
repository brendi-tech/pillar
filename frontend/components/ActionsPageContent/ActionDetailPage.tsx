"use client";

import { PageHeader } from "@/components/shared";
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
  ExternalLink,
  Layout,
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
  copy: Copy,
  "external-link": ExternalLink,
  "play-circle": PlayCircle,
};

function getImplementationStatusDisplay(status: ImplementationStatus): {
  className: string;
  icon: React.ReactNode;
  description: string;
} {
  switch (status) {
    case "verified":
      return {
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
        icon: <CheckCircle2 className="h-4 w-4" />,
        description:
          "The customer has successfully implemented this action handler.",
      };
    case "failing":
      return {
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        icon: <XCircle className="h-4 w-4" />,
        description: "The last execution reported a failure.",
      };
    case "stale":
      return {
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        icon: <Clock className="h-4 w-4" />,
        description: "No confirmations received in the last 30 days.",
      };
    default:
      return {
        className:
          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        icon: <CircleHelp className="h-4 w-4" />,
        description: "No execution confirmations have been received yet.",
      };
  }
}

/**
 * Action Detail Page - Read-Only View
 *
 * Code-First Actions: Displays action details synced from code.
 * No editing is allowed - all changes must be made in client code.
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
        <div className="space-y-6 p-6">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
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

  return (
    <div className="@container h-full overflow-auto">
      <div className="space-y-6 p-6">
        <PageHeader
          title={deriveActionLabel(action.name)}
          description={`Action: ${action.name}`}
        />

        {/* Code-First Notice */}
        <Alert>
          <Code2 className="h-4 w-4" />
          <AlertTitle>Code-First Action</AlertTitle>
          <AlertDescription>
            This action is defined in your client code. To modify it, update the
            action definition in your codebase and deploy to sync changes.
          </AlertDescription>
        </Alert>

        {/* Action Details */}
        <div className="grid gap-6 @min-[700px]:grid-cols-3">
          {/* Main Details */}
          <div className="space-y-6 @min-[700px]:col-span-2">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
                <CardDescription>
                  The AI uses this to understand when to suggest this action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{action.description}</p>
              </CardContent>
            </Card>

            {/* Action Type & Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Action Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <ActionIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {ACTION_TYPE_LABELS[action.action_type]}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {action.action_type}
                    </div>
                  </div>
                </div>

                {action.action_type === "navigate" && action.path_template && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Path Template
                    </div>
                    <code className="block rounded bg-muted px-3 py-2 text-sm">
                      {action.path_template}
                    </code>
                  </div>
                )}

                {action.action_type === "external_link" &&
                  action.external_url && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        External URL
                      </div>
                      <code className="block rounded bg-muted px-3 py-2 text-sm">
                        {action.external_url}
                      </code>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Execution Behavior */}
            <Card>
              <CardHeader>
                <CardTitle>Execution Behavior</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 @sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm">Auto-run when suggested</span>
                    <Badge variant={action.auto_run ? "default" : "secondary"}>
                      {action.auto_run ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm">
                      Auto-complete after execution
                    </span>
                    <Badge
                      variant={action.auto_complete ? "default" : "secondary"}
                    >
                      {action.auto_complete ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Schema (if defined) */}
            {action.data_schema &&
              Object.keys(action.data_schema).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Data Schema</CardTitle>
                    <CardDescription>
                      Data the AI extracts from user messages
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                      {JSON.stringify(action.data_schema, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    action.status === "published" ? "default" : "secondary"
                  }
                  className="text-sm"
                >
                  {action.status}
                </Badge>
              </CardContent>
            </Card>

            {/* Implementation Status - only for published */}
            {action.status === "published" && (
              <Card>
                <CardHeader>
                  <CardTitle>Implementation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge
                    className={`flex w-fit items-center gap-1 ${getImplementationStatusDisplay(action.implementation_status).className}`}
                  >
                    {
                      getImplementationStatusDisplay(
                        action.implementation_status
                      ).icon
                    }
                    {IMPLEMENTATION_STATUS_LABELS[action.implementation_status]}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {
                      getImplementationStatusDisplay(
                        action.implementation_status
                      ).description
                    }
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-emerald-600">
                        {action.confirmation_success_count}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Successes
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">
                        {action.confirmation_failure_count}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Failures
                      </div>
                    </div>
                  </div>

                  {action.last_confirmed_at && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Last confirmed{" "}
                      {formatDistanceToNow(new Date(action.last_confirmed_at), {
                        addSuffix: true,
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Executions</dt>
                    <dd className="font-medium">{action.execution_count}</dd>
                  </div>
                  {action.last_executed_at && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Last executed</dt>
                      <dd className="font-medium">
                        {formatDistanceToNow(
                          new Date(action.last_executed_at),
                          {
                            addSuffix: true,
                          }
                        )}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Has embedding</dt>
                    <dd className="font-medium">
                      {action.has_embedding ? "Yes" : "No"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* SDK Implementation Hint */}
            <Card>
              <CardHeader>
                <CardTitle>SDK Handler</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                  {`pillar.onAction('${action.name}', (data) => {
  // Your handler code
});`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
