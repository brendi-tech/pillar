// ============================================================================
// Action Types
// ============================================================================

/**
 * Types of actions an action can perform when executed by the widget.
 */
export type ActionType =
  | 'navigate'        // Navigate to a page in the host app
  | 'open_modal'      // Open a modal/dialog
  | 'fill_form'       // Fill form fields with data
  | 'trigger_action'  // Trigger a custom action (generic)
  | 'query'           // Query data from the client and return to the agent
  | 'copy_text'       // Copy text to clipboard
  | 'external_link'   // Open external link in new tab
  | 'start_tutorial'  // Start a tutorial/walkthrough
  | 'inline_ui';      // Render inline UI via a custom card

/**
 * Action publishing status.
 */
export type ActionStatus = 'draft' | 'published' | 'archived';

/**
 * Deployment platform types.
 */
export type DeploymentPlatform = 'web' | 'ios' | 'android' | 'desktop';

/**
 * Implementation verification status.
 * Tracks whether the customer has successfully implemented the action handler.
 */
export type ImplementationStatus = 'unknown' | 'verified' | 'failing' | 'stale';

/**
 * Main Action interface - matches backend serializer output.
 * 
 * Simplified model:
 * - Server defines: name, description, action_type, payload
 * - SDK derives: presentation (label from name, icon from action_type)
 * - AI matching: semantic similarity via description_embedding
 */
export interface Action {
  id: string;
  product: string;
  
  // Identification
  name: string;           // Unique identifier (e.g., 'open_invite_flow')
  description: string;    // AI context for when to suggest this action
  examples: string[];     // Trigger phrases that improve search ranking
  has_embedding: boolean; // Whether the action has a semantic embedding
  
  // Type & Config
  action_type: ActionType;
  path_template?: string;  // For navigate type
  external_url?: string;   // For external_link type
  
  // Data Payload
  data_schema?: Record<string, unknown>;
  default_data?: Record<string, unknown>;
  parameter_examples?: Array<{ description: string; parameters: Record<string, unknown> }>;
  
  // Context Requirements
  required_context: Record<string, unknown>;
  
  // Execution Behavior
  auto_run: boolean;        // If true, action executes immediately when suggested
  auto_complete: boolean;   // If true, action completes without host confirmation
  returns_data: boolean;    // If true, handler returns data for the agent
  
  // Status
  status: ActionStatus;
  
  // Analytics
  execution_count: number;
  last_executed_at: string | null;
  
  // Implementation Tracking
  implementation_status: ImplementationStatus;
  confirmation_success_count: number;
  confirmation_failure_count: number;
  last_confirmed_at: string | null;
  last_confirmation_status: string;
  last_confirmation_error: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Action Deployment Types
// ============================================================================

/**
 * Action deployment - a versioned snapshot of actions for a platform.
 */
export interface ActionDeployment {
  id: string;
  organization: string;
  help_center_config: string;

  // Platform & Version
  platform: DeploymentPlatform;
  platform_display?: string;
  version: string;

  // Actions
  action_count: number;
  actions?: string[]; // Action IDs

  // Status
  is_active: boolean;

  // Metadata
  deployed_at: string;
  deployed_by: string;
  git_sha: string;
  manifest_hash: string;
}

/**
 * List response from deployments API.
 */
export interface ActionDeploymentListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ActionDeployment[];
}

/**
 * Pre-built action template for quick creation.
 * Simplified: only server-side fields.
 */
export interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  action_type: ActionType;
  path_template?: string;
}

/**
 * Request payload for creating a new action.
 * Simplified: only server-side fields.
 */
export interface ActionCreateRequest {
  help_center_config: string;
  name: string;
  description: string;
  action_type?: ActionType;
  path_template?: string;
  external_url?: string;
  data_schema?: Record<string, unknown>;
  default_data?: Record<string, unknown>;
  required_context?: Record<string, unknown>;
  auto_run?: boolean;
  auto_complete?: boolean;
  status?: ActionStatus;
}

/**
 * Request payload for updating an existing action.
 */
export interface ActionUpdateRequest {
  name?: string;
  description?: string;
  action_type?: ActionType;
  path_template?: string;
  external_url?: string;
  data_schema?: Record<string, unknown>;
  default_data?: Record<string, unknown>;
  required_context?: Record<string, unknown>;
  auto_run?: boolean;
  auto_complete?: boolean;
  status?: ActionStatus;
}

/**
 * AI-generated action suggestion from description.
 * Returned by the generate-suggestion endpoint.
 */
export interface ActionGenerationSuggestion {
  identifier: string;
  action_type: ActionType;
  path_template?: string;
  external_url?: string;
  default_data: Record<string, unknown>;
  confidence: number;
  reasoning: string;
}

/**
 * List response from actions API.
 */
export interface ActionListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Action[];
}

/**
 * Action stats response.
 */
export interface ActionStatsResponse {
  execution_count: number;
  last_executed_at: string | null;
  status: ActionStatus;
}

// ============================================================================
// Action Suggestion Types (AI-generated suggestions from content)
// ============================================================================

/**
 * Action data extracted by AI from article content.
 */
export interface ActionSuggestionData {
  name: string;
  description: string;
  action_type: ActionType;
  confidence: number;
  path_template?: string;
}

/**
 * AI-generated action suggestion from content analysis.
 */
export interface ActionSuggestion {
  id: string;
  title: string;
  reason: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  created_at: string;
  action_data: ActionSuggestionData;
  source_article_id: string | null;
  source_article_title: string;
  reasoning: string;
}

/**
 * Response from action suggestions list endpoint.
 */
export interface ActionSuggestionsResponse {
  results: ActionSuggestion[];
  count: number;
}

/**
 * Request to trigger action suggestion analysis.
 */
export interface ActionSuggestionTriggerRequest {
  help_center_config_id: string;
  article_ids?: string[];
  min_confidence?: number;
}

/**
 * Response from triggering action suggestion workflow.
 */
export interface ActionSuggestionTriggerResponse {
  workflow_id: string;
  status: string;
  message: string;
}

/**
 * Request to apply an action suggestion.
 */
export interface ActionSuggestionApplyRequest {
  overrides?: Partial<ActionSuggestionData>;
}

// ============================================================================
// Helper Constants
// ============================================================================

/**
 * Human-readable labels for action types.
 */
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  navigate: 'Navigate to Page',
  open_modal: 'Open Modal/Dialog',
  fill_form: 'Fill Form Fields',
  trigger_action: 'Trigger Custom Action',
  query: 'Query Data',
  copy_text: 'Copy to Clipboard',
  external_link: 'Open External Link',
  start_tutorial: 'Start Tutorial',
  inline_ui: 'Inline UI',
};

/**
 * Icon suggestions for each action type.
 * Used by SDK to derive default icons.
 */
export const ACTION_TYPE_ICONS: Record<ActionType, string> = {
  navigate: 'arrow-right',
  open_modal: 'layout',
  fill_form: 'edit-3',
  trigger_action: 'zap',
  query: 'database',
  copy_text: 'copy',
  external_link: 'external-link',
  start_tutorial: 'play-circle',
  inline_ui: 'layout-panel-left',
};

/**
 * Descriptions for each action type.
 */
export const ACTION_TYPE_DESCRIPTIONS: Record<ActionType, string> = {
  navigate: 'Redirect the user to a specific page or route in your app',
  open_modal: 'Open a modal, dialog, or slide-over panel',
  fill_form: 'Pre-fill form fields with specific values',
  trigger_action: 'Execute a custom action handler in your app',
  query: 'Query data from the client and return results to the agent',
  copy_text: 'Copy text content to the user\'s clipboard',
  external_link: 'Open an external URL in a new browser tab',
  start_tutorial: 'Start an interactive tutorial or product walkthrough',
  inline_ui: 'Render inline UI via a custom card component',
};

/**
 * Status labels for display.
 */
export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

/**
 * Status colors for badges.
 */
export const ACTION_STATUS_COLORS: Record<ActionStatus, string> = {
  draft: 'yellow',
  published: 'green',
  archived: 'gray',
};


/**
 * Human-readable labels for deployment platforms.
 */
export const DEPLOYMENT_PLATFORM_LABELS: Record<DeploymentPlatform, string> = {
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
  desktop: 'Desktop',
};

/**
 * Colors for deployment platform badges.
 */
export const DEPLOYMENT_PLATFORM_COLORS: Record<DeploymentPlatform, string> = {
  web: 'blue',
  ios: 'purple',
  android: 'green',
  desktop: 'orange',
};

/**
 * Button variant for action preview in the admin panel.
 * Maps to shadcn/ui Button component variants.
 */
export type ActionButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';

/**
 * Human-readable labels for implementation status.
 */
export const IMPLEMENTATION_STATUS_LABELS: Record<ImplementationStatus, string> = {
  unknown: 'Unknown',
  verified: 'Verified',
  failing: 'Failing',
  stale: 'Stale',
};

/**
 * Colors for implementation status badges.
 */
export const IMPLEMENTATION_STATUS_COLORS: Record<ImplementationStatus, string> = {
  unknown: 'secondary',
  verified: 'success',
  failing: 'destructive',
  stale: 'warning',
};

/**
 * Helper function to derive a human-readable label from an action name.
 * Converts snake_case to Title Case.
 */
export function deriveActionLabel(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Helper function to get the default icon for an action type.
 */
export function getActionTypeIcon(actionType: ActionType): string {
  return ACTION_TYPE_ICONS[actionType] || 'zap';
}
