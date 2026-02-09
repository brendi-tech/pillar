// ============================================================================
// Action Task Types
// ============================================================================

/**
 * Types of actions a task can perform when executed by the widget.
 */
export type TaskType =
  | 'navigate'        // Navigate to a page in the host app
  | 'open_modal'      // Open a modal/dialog
  | 'fill_form'       // Fill form fields with data
  | 'trigger_action'  // Trigger a custom action (generic)
  | 'copy_text'       // Copy text to clipboard
  | 'external_link'   // Open external link in new tab
  | 'start_tutorial'; // Start a tutorial/walkthrough

/**
 * Task publishing status.
 */
export type TaskStatus = 'draft' | 'published' | 'archived';

/**
 * Implementation verification status.
 * Tracks whether the customer has successfully implemented the task handler.
 */
export type ImplementationStatus = 'unknown' | 'verified' | 'failing' | 'stale';

/**
 * Main ActionTask interface - matches backend serializer output.
 * 
 * Simplified model:
 * - Server defines: name, description, task_type, payload
 * - SDK derives: presentation (label from name, icon from task_type)
 * - AI matching: semantic similarity via description_embedding
 */
export interface Task {
  id: string;
  organization: string;
  help_center_config: string;
  
  // Identification
  name: string;           // Unique identifier (e.g., 'open_invite_flow')
  description: string;    // AI context for when to suggest this task
  has_embedding: boolean; // Whether the task has a semantic embedding
  
  // Type & Config
  task_type: TaskType;
  task_type_display: string;
  path_template?: string;  // For navigate type
  external_url?: string;   // For external_link type
  
  // Data Payload
  data_schema?: Record<string, unknown>;
  default_data?: Record<string, unknown>;
  
  // Context Requirements
  required_context: Record<string, unknown>;
  
  // Status
  status: TaskStatus;
  status_display: string;
  
  // Analytics
  execution_count: number;
  last_executed_at: string | null;
  
  // Implementation Tracking
  implementation_status: ImplementationStatus;
  implementation_status_display: string;
  confirmation_success_count: number;
  confirmation_failure_count: number;
  last_confirmed_at: string | null;
  last_confirmation_status: string;
  last_confirmation_error: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Pre-built task template for quick creation.
 * Simplified: only server-side fields.
 */
export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  task_type: TaskType;
  path_template?: string;
}

/**
 * Request payload for creating a new task.
 * Simplified: only server-side fields.
 */
export interface TaskCreateRequest {
  help_center_config: string;
  name: string;
  description: string;
  task_type?: TaskType;
  path_template?: string;
  external_url?: string;
  data_schema?: Record<string, unknown>;
  default_data?: Record<string, unknown>;
  required_context?: Record<string, unknown>;
  status?: TaskStatus;
}

/**
 * Request payload for updating an existing task.
 */
export interface TaskUpdateRequest {
  name?: string;
  description?: string;
  task_type?: TaskType;
  path_template?: string;
  external_url?: string;
  data_schema?: Record<string, unknown>;
  default_data?: Record<string, unknown>;
  required_context?: Record<string, unknown>;
  status?: TaskStatus;
}

/**
 * AI-generated task suggestion from description.
 * Returned by the generate-suggestion endpoint.
 */
export interface TaskGenerationSuggestion {
  identifier: string;
  task_type: TaskType;
  path_template?: string;
  external_url?: string;
  default_data: Record<string, unknown>;
  confidence: number;
  reasoning: string;
}

/**
 * List response from tasks API.
 */
export interface TaskListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Task[];
}

/**
 * Task stats response.
 */
export interface TaskStatsResponse {
  execution_count: number;
  last_executed_at: string | null;
  status: TaskStatus;
}

// ============================================================================
// Task Suggestion Types (AI-generated suggestions from content)
// ============================================================================

/**
 * Task data extracted by AI from article content.
 */
export interface TaskSuggestionData {
  name: string;
  description: string;
  task_type: TaskType;
  confidence: number;
  path_template?: string;
}

/**
 * AI-generated task suggestion from content analysis.
 */
export interface TaskSuggestion {
  id: string;
  title: string;
  reason: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  created_at: string;
  task_data: TaskSuggestionData;
  source_article_id: string | null;
  source_article_title: string;
  reasoning: string;
}

/**
 * Response from task suggestions list endpoint.
 */
export interface TaskSuggestionsResponse {
  results: TaskSuggestion[];
  count: number;
}

/**
 * Request to trigger task suggestion analysis.
 */
export interface TaskSuggestionTriggerRequest {
  help_center_config_id: string;
  article_ids?: string[];
  min_confidence?: number;
}

/**
 * Response from triggering task suggestion workflow.
 */
export interface TaskSuggestionTriggerResponse {
  workflow_id: string;
  status: string;
  message: string;
}

/**
 * Request to apply a task suggestion.
 */
export interface TaskSuggestionApplyRequest {
  overrides?: Partial<TaskSuggestionData>;
}

// ============================================================================
// Helper Constants
// ============================================================================

/**
 * Human-readable labels for task types.
 */
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  navigate: 'Navigate to Page',
  open_modal: 'Open Modal/Dialog',
  fill_form: 'Fill Form Fields',
  trigger_action: 'Trigger Custom Action',
  copy_text: 'Copy to Clipboard',
  external_link: 'Open External Link',
  start_tutorial: 'Start Tutorial',
};

/**
 * Icon suggestions for each task type.
 * Used by SDK to derive default icons.
 */
export const TASK_TYPE_ICONS: Record<TaskType, string> = {
  navigate: 'arrow-right',
  open_modal: 'layout',
  fill_form: 'edit-3',
  trigger_action: 'zap',
  copy_text: 'copy',
  external_link: 'external-link',
  start_tutorial: 'play-circle',
};

/**
 * Descriptions for each task type.
 */
export const TASK_TYPE_DESCRIPTIONS: Record<TaskType, string> = {
  navigate: 'Redirect the user to a specific page or route in your app',
  open_modal: 'Open a modal, dialog, or slide-over panel',
  fill_form: 'Pre-fill form fields with specific values',
  trigger_action: 'Execute a custom action handler in your app',
  copy_text: 'Copy text content to the user\'s clipboard',
  external_link: 'Open an external URL in a new browser tab',
  start_tutorial: 'Start an interactive tutorial or product walkthrough',
};

/**
 * Status labels for display.
 */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

/**
 * Status colors for badges.
 */
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  draft: 'yellow',
  published: 'green',
  archived: 'gray',
};

/**
 * Button variant for task preview in the admin panel.
 * Maps to shadcn/ui Button component variants.
 */
export type TaskButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';

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
 * Helper function to derive a human-readable label from a task name.
 * Converts snake_case to Title Case.
 */
export function deriveTaskLabel(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Helper function to get the default icon for a task type.
 */
export function getTaskTypeIcon(taskType: TaskType): string {
  return TASK_TYPE_ICONS[taskType] || 'zap';
}
