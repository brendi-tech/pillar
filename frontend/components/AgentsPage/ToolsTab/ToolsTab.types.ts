import type { ReactNode } from "react";
import type {
  Agent,
  AgentOpenAPISourceConfig,
  AgentMCPSourceConfig,
} from "@/types/agent";
import type { MCPToolSource } from "@/types/mcpSource";
import type { OpenAPIToolSource } from "@/types/openAPISource";

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  tool_type: string;
  channel_compatibility: string[];
  auto_run: boolean;
}

export interface ToolsTabProps {
  agent: Agent;
  productId: string;
  onChange: (updates: Partial<Agent>) => void;
}

export type SelectionState = "all" | "some" | "none";

export interface ConfirmationState {
  value: boolean;
  readOnly: boolean;
  hasOverride?: boolean;
}

export interface ContextControls {
  dmsChecked: boolean;
  publicChecked: boolean;
  onDmsToggle: (checked: boolean) => void;
  onPublicToggle: (checked: boolean) => void;
}

export interface ToolRowProps {
  name: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  method?: string;
  path?: string;
  confirmation?: ConfirmationState | null;
  onConfirmToggle?: () => void;
  contextControls?: ContextControls | null;
  disabled?: boolean;
}

export interface ToolSourceSectionProps {
  id: string;
  icon: ReactNode;
  title: string;
  count: number;
  enabledCount?: number;
  selectionState: SelectionState;
  onSelectAll: (selectAll: boolean) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  healthDot?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  authAction?: ReactNode;
  contextColumnHeaders?: boolean;
  children: ReactNode;
}

export interface ToolsHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  enabledCount: number;
  totalCount: number;
  onEnableAll: () => void;
  onDisableAll: () => void;
  hasNoTools: boolean;
}

export const CHANNELS_WITH_CONTEXT = ["discord", "slack"] as const;

export type OverrideField = "is_enabled" | "requires_confirmation";
