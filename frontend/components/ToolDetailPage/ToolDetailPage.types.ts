import type { Action, ActionExecutionLog, ImplementationStatus } from "@/types/actions";

export interface ToolDetailPageProps {
  toolId: string;
}

export interface ImplementationStatusDisplay {
  className: string;
  icon: React.ReactNode;
  description: string;
}

export interface ExecutionFlagsProps {
  autoRun: boolean;
  autoComplete: boolean;
  returnsData: boolean;
}

export interface ExamplePhrasesProps {
  examples: string[];
}

export interface JsonCardProps {
  title: string;
  description: string;
  data: Record<string, unknown>;
}

export interface ParameterExamplesCardProps {
  examples: Array<{
    description?: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface ImplementationStatsCardProps {
  action: Action;
  implStatus: ImplementationStatusDisplay;
}

export interface ExecutionLogsCardProps {
  logs: ActionExecutionLog[];
}

export interface ExecutionLogItemProps {
  log: ActionExecutionLog;
}
