export type OpenAPIAuthType =
  | 'none'
  | 'api_key'
  | 'bearer'
  | 'oauth2_client_credentials'
  | 'oauth2_authorization_code';

export type OpenAPIDiscoveryStatus = 'pending' | 'success' | 'error';

export interface OpenAPIOperation {
  operation_id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  input_schema: Record<string, unknown>;
  security: unknown[];
  parameters_meta: Record<string, string>;
}

export interface OpenAPIOperationConfigItem {
  id: string;
  tool_name: string;
  is_enabled: boolean;
  requires_confirmation: boolean;
}

export interface OpenAPIToolSource {
  id: string;
  name: string;
  slug: string;
  spec_url: string;
  spec_format: string;
  spec_version: string;
  base_url: string;
  auth_type: OpenAPIAuthType;
  discovered_operations: OpenAPIOperation[];
  operation_count: number;
  operation_configs: OpenAPIOperationConfigItem[];
  has_spec_content: boolean;
  current_version_number: number;
  version_count: number;
  current_version_display: string;
  last_discovery_at: string | null;
  discovery_status: OpenAPIDiscoveryStatus;
  discovery_error: string;
  is_active: boolean;
  last_ping_at: string | null;
  last_ping_success: boolean;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
  oauth_client_id: string;
  oauth_authorization_endpoint: string;
  oauth_token_endpoint: string;
  oauth_scopes: string;
  oauth_environments: Array<{ name: string; extra_scope: string; credential_key?: string }>;
  oauth_token_exchange_url: string;
}

export interface OpenAPIToolSourceVersion {
  id: string;
  version_number: number;
  spec_version: string;
  revision: number;
  label: string;
  display_version: string;
  operation_count: number;
  spec_format: string;
  spec_url: string;
  spec_content?: string;
  created_at: string;
  discovered_operations?: OpenAPIOperation[];
}

export interface CreateOpenAPIToolSourcePayload {
  name: string;
  spec_url?: string;
  spec_content?: string;
  slug?: string;
  base_url?: string;
  auth_type: OpenAPIAuthType;
  auth_credentials?: Record<string, string>;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_authorization_endpoint?: string;
  oauth_token_endpoint?: string;
  oauth_scopes?: string;
  oauth_environments?: Array<{ name: string; extra_scope: string; credential_key?: string }>;
  oauth_token_exchange_url?: string;
  product_id: string;
}

export interface OpenAPIProbeResult {
  valid: boolean;
  title?: string;
  version?: string;
  server_url?: string;
  operation_count?: number;
  security_schemes?: Record<string, unknown>;
  operations_preview?: Array<{
    operation_id: string;
    method: string;
    path: string;
    summary: string;
  }>;
  error?: string;
}
