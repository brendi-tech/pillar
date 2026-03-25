export type AgentChannel = 'web' | 'slack' | 'discord' | 'email' | 'api' | 'mcp';

export type AgentTone = 'professional' | 'friendly' | 'neutral' | 'concise' | 'formal';

export type KnowledgeScopeMode = 'all' | 'all_internal' | 'all_external' | 'selected';

export const KNOWLEDGE_SCOPE_LABELS: Record<KnowledgeScopeMode, string> = {
  all: 'All Sources',
  all_internal: 'All Internal',
  all_external: 'All External',
  selected: 'Selected Sources',
};

export type ToolScopeMode = 'all' | 'all_server_side' | 'all_client_side' | 'restricted' | 'allowed' | 'none';

export const TOOL_SCOPE_LABELS: Record<ToolScopeMode, string> = {
  all: 'All Tools',
  all_server_side: 'All Server-Side',
  all_client_side: 'All Client-Side',
  restricted: 'All With Restrictions',
  allowed: 'Allowed Only',
  none: 'No Tools',
};

export const CHANNEL_BADGE_STYLES: Record<string, string> = {
  discord:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  slack:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  web: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  email: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  api: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  mcp: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

export const CHANNEL_LABELS: Record<AgentChannel, string> = {
  web: 'Web Widget',
  slack: 'Slack',
  discord: 'Discord',
  email: 'Email',
  api: 'API',
  mcp: 'MCP Server',
};

export const CLIENT_SIDE_CHANNELS: AgentChannel[] = ['web', 'api'];

export const TONE_LABELS: Record<AgentTone, string> = {
  professional: 'Professional',
  friendly: 'Friendly',
  neutral: 'Neutral',
  concise: 'Concise',
  formal: 'Formal',
};

export interface AgentToolOverrideItem {
  tool_name: string;
  is_enabled: boolean | null;
  requires_confirmation: boolean | null;
}

export interface AgentOpenAPISourceConfig {
  openapi_source_id: string;
  operation_overrides: AgentToolOverrideItem[];
}

export interface AgentMCPSourceConfig {
  mcp_source_id: string;
  tool_overrides: AgentToolOverrideItem[];
}

export interface Agent {
  id: string;
  organization: string;
  product: string;
  name: string;
  slug: string;
  channel: AgentChannel;
  is_active: boolean;
  tone: AgentTone | '';
  guidance_override: string;
  tool_scope: ToolScopeMode;
  tool_restriction_ids: string[];
  tool_allowance_ids: string[];
  tool_context_restrictions: Record<string, string[]>;
  max_response_tokens: number | null;
  include_sources: boolean;
  include_suggested_followups: boolean;
  llm_model: string;
  temperature: number | null;
  channel_config: Record<string, unknown>;
  mcp_domain: string | null;
  cf_custom_hostname_id: string | null;
  default_language: string;
  knowledge_scope: KnowledgeScopeMode;
  knowledge_source_ids: string[];
  mcp_source_ids: string[];
  mcp_sources_config: AgentMCPSourceConfig[];
  openapi_source_ids: string[];
  openapi_sources_config: AgentOpenAPISourceConfig[];
  created_at: string;
  updated_at: string;
}

export interface CreateAgentPayload {
  name: string;
  channel: AgentChannel;
  is_active?: boolean;
  tone?: AgentTone | '';
  guidance_override?: string;
  tool_scope?: ToolScopeMode;
  tool_restriction_ids?: string[];
  tool_allowance_ids?: string[];
  tool_context_restrictions?: Record<string, string[]>;
  max_response_tokens?: number | null;
  include_sources?: boolean;
  include_suggested_followups?: boolean;
  llm_model?: string;
  temperature?: number | null;
  channel_config?: Record<string, unknown>;
  mcp_domain?: string | null;
  default_language?: string;
  knowledge_scope?: KnowledgeScopeMode;
  knowledge_source_ids?: string[];
  mcp_sources_config?: AgentMCPSourceConfig[];
  openapi_sources_config?: AgentOpenAPISourceConfig[];
}

export type UpdateAgentPayload = Partial<Omit<CreateAgentPayload, 'channel'>>;
