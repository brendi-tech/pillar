"use client";

import {
  DetailHeader,
  DetailPageShell,
  MetadataStrip,
  SectionLabel,
} from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { actionDetailQuery } from "@/queries/actions.queries";
import {
  ACTION_TYPE_LABELS,
  deriveActionLabel,
  getActionTypeIcon,
} from "@/types/actions";
import { useQuery } from "@tanstack/react-query";
import { Code2, Zap } from "lucide-react";

import { ExecutionFlags } from "./ExecutionFlags";
import { ExecutionLogsCard } from "./ExecutionLogsCard";
import { ExamplePhrases } from "./ExamplePhrases";
import { ImplementationStatsCard } from "./ImplementationStatsCard";
import { JsonCard, ParameterExamplesCard } from "./JsonCard";
import {
  buildMetadataItems,
  getImplementationStatusDisplay,
  TOOL_ICON_COMPONENTS,
} from "./ToolDetailPage.helpers";
import type { ToolDetailPageProps } from "./ToolDetailPage.types";

export function ToolDetailPage({ toolId }: ToolDetailPageProps) {
  const {
    data: action,
    isLoading,
    error,
    refetch,
  } = useQuery(actionDetailQuery(toolId));

  const actionIconName = action
    ? getActionTypeIcon(action.action_type)
    : undefined;
  const ActionIcon = actionIconName
    ? TOOL_ICON_COMPONENTS[actionIconName] || Zap
    : Zap;
  const implStatus = action
    ? getImplementationStatusDisplay(action.implementation_status)
    : undefined;

  const metadataItems = action ? buildMetadataItems(action) : [];

  return (
    <DetailPageShell
      isLoading={isLoading}
      error={error ?? null}
      isEmpty={!action && !isLoading && !error}
      emptyTitle="Tool not found"
      emptyDescription="Select a tool from the sidebar to view its details."
      onRetry={refetch}
    >
      {action && implStatus && (
        <>
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

          <Alert className="max-w-prose">
            <Code2 className="h-4 w-4" />
            <AlertTitle>Code-First Tool</AlertTitle>
            <AlertDescription>
              Defined in client code. Update the tool definition in your
              codebase and deploy to sync changes.
            </AlertDescription>
          </Alert>

          {metadataItems.length > 0 && <MetadataStrip items={metadataItems} />}

          <ExecutionFlags
            autoRun={action.auto_run}
            autoComplete={action.auto_complete}
            returnsData={action.returns_data}
          />

          <div>
            <SectionLabel>Description</SectionLabel>
            <p className="max-w-prose text-sm leading-relaxed">
              {action.description}
            </p>
          </div>

          <ExamplePhrases examples={action.examples ?? []} />

          <JsonCard
            title="Data Schema"
            description="Parameters the AI extracts from user messages"
            data={action.data_schema as Record<string, unknown>}
          />

          <JsonCard
            title="Default Data"
            description="Fallback values when the AI doesn't extract specifics"
            data={action.default_data as Record<string, unknown>}
          />

          <ParameterExamplesCard examples={action.parameter_examples ?? []} />

          <JsonCard
            title="Required Context"
            description="Only surfaces when user context matches these requirements"
            data={action.required_context as Record<string, unknown>}
          />

          <ImplementationStatsCard action={action} implStatus={implStatus} />

          <ExecutionLogsCard logs={action.execution_logs ?? []} />
        </>
      )}
    </DetailPageShell>
  );
}
