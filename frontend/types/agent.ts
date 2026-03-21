export type AgentChannel = 'web' | 'slack' | 'discord' | 'email' | 'api';

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

export const CHANNEL_LABELS: Record<AgentChannel, string> = {
  web: 'Web Widget',
  slack: 'Slack',
  discord: 'Discord',
  email: 'Email',
  api: 'API',
};

export const CLIENT_SIDE_CHANNELS: AgentChannel[] = ['web', 'api'];

export const TONE_LABELS: Record<AgentTone, string> = {
  professional: 'Professional',
  friendly: 'Friendly',
  neutral: 'Neutral',
  concise: 'Concise',
  formal: 'Formal',
};

export interface Agent {
  id: string;
  organization: string;
  product: string;
  name: string;
  channel: AgentChannel;
  is_active: boolean;
  tone: AgentTone | '';
  guidance_override: string;
  tool_scope: ToolScopeMode;
  tool_restriction_ids: string[];
  tool_allowance_ids: string[];
  max_response_tokens: number | null;
  include_sources: boolean;
  include_suggested_followups: boolean;
  llm_model: string;
  temperature: number | null;
  channel_config: Record<string, unknown>;
  default_language: string;
  knowledge_scope: KnowledgeScopeMode;
  knowledge_source_ids: string[];
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
  max_response_tokens?: number | null;
  include_sources?: boolean;
  include_suggested_followups?: boolean;
  llm_model?: string;
  temperature?: number | null;
  channel_config?: Record<string, unknown>;
  default_language?: string;
  knowledge_scope?: KnowledgeScopeMode;
  knowledge_source_ids?: string[];
}

export type UpdateAgentPayload = Partial<Omit<CreateAgentPayload, 'channel'>>;
