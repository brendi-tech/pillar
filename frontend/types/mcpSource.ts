export type MCPAuthType = 'none' | 'bearer' | 'header' | 'oauth';
export type MCPOAuthMode = 'org' | 'client';
export type MCPDiscoveryStatus = 'pending' | 'success' | 'error';
export type MCPOAuthStatus =
  | 'none'
  | 'discovering'
  | 'authorization_required'
  | 'authorized'
  | 'expired'
  | 'error';

export interface MCPDiscoveredTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPDiscoveredResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPDiscoveredPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPToolConfigItem {
  id: string;
  tool_name: string;
  is_enabled: boolean;
  requires_confirmation: boolean;
}

export interface MCPToolSource {
  id: string;
  name: string;
  slug: string;
  url: string;
  auth_type: MCPAuthType;
  oauth_mode: MCPOAuthMode;
  discovered_tools: MCPDiscoveredTool[];
  tool_count: number;
  tool_configs: MCPToolConfigItem[];
  discovered_resources: MCPDiscoveredResource[];
  resource_count: number;
  discovered_prompts: MCPDiscoveredPrompt[];
  prompt_count: number;
  last_discovery_at: string | null;
  discovery_status: MCPDiscoveryStatus;
  discovery_error: string;
  is_active: boolean;
  last_ping_at: string | null;
  last_ping_success: boolean;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
  oauth_status: MCPOAuthStatus;
  oauth_token_expires_at: string | null;
}

export interface CreateMCPToolSourcePayload {
  name: string;
  url: string;
  auth_type: MCPAuthType;
  auth_credentials?: Record<string, string>;
  oauth_mode?: MCPOAuthMode;
  product_id: string;
}

export type MCPProbeDetectedType = 'none' | 'bearer' | 'oauth';

export interface MCPProbeResult {
  reachable: boolean;
  auth_required: boolean;
  detected_type: MCPProbeDetectedType;
  authorization_endpoint?: string;
  token_endpoint?: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  resource_metadata_url?: string;
  error?: string;
}
