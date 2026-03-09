/**
 * Centralized notification registry.
 * 
 * Add new frontend notifications here - single file for config + conditions.
 * The provider automatically picks them up.
 */

import type { KnowledgeSourceConfig } from '@/types/sources';
import type { IntegrationStatus } from '@/types/v2/products';
import type { NotificationSeverity } from '@/types/notifications';

// ============================================================================
// Context passed to condition functions
// ============================================================================

export interface NotificationContext {
  /** Knowledge sources for the current product */
  sources: KnowledgeSourceConfig[];
  /** SDK integration status */
  integrationStatus: IntegrationStatus | null;
  /** When the product was created (for time-based conditions) */
  productCreatedAt: string | null;
  /** Whether data is still loading */
  isLoading: boolean;
  /** Current organization's billing plan */
  organizationPlan: string | null;
}

// ============================================================================
// Notification Rule Definition
// ============================================================================

export interface NotificationConfig {
  /** Unique identifier for this notification type */
  type: string;
  /** 
   * Severity determines display and dismissibility:
   * - critical: Red, cannot dismiss, must resolve
   * - warning: Amber, cannot dismiss, must resolve
   * - info: Blue, can dismiss (7d), tips/marketing
   */
  severity: NotificationSeverity;
  /** Short title shown prominently */
  title: string;
  /** Longer description message */
  message: string;
  /** Optional call-to-action button */
  action?: {
    label: string;
    href: string;
  };
  /** Whether user can dismiss (derived from severity if not set) */
  dismissible?: boolean;
  /** How long dismissal lasts in ms */
  dismissDuration?: number;
}

export interface NotificationRule {
  /** Notification configuration */
  config: NotificationConfig;
  /** 
   * Condition function - return true if notification should show.
   * Has access to sources, integration status, and loading state.
   */
  condition: (ctx: NotificationContext) => boolean;
}

// ============================================================================
// Notification Registry
// ============================================================================

/**
 * All frontend-calculated notifications.
 * 
 * To add a new notification:
 * 1. Add a new entry to this array
 * 2. Define the config (type, severity, title, message, action)
 * 3. Define the condition function
 * 
 * Priority is determined by severity (critical > warning > info),
 * then by order in this array for same-severity notifications.
 */
export const NOTIFICATION_REGISTRY: NotificationRule[] = [
  // -------------------------------------------------------------------------
  // SDK Installation (Critical - cannot dismiss)
  // -------------------------------------------------------------------------
  {
    config: {
      type: 'sdk_not_initialized',
      severity: 'critical',
      title: 'SDK Not Installed',
      message: 'Install the Pillar SDK to enable your AI assistant on your site.',
      action: {
        label: 'Setup Guide',
        href: '/setup',
      },
    },
    condition: ({ integrationStatus, productCreatedAt, isLoading }) => {
      if (isLoading) return false;
      if (!integrationStatus) return false;
      if (integrationStatus.sdk_initialized) return false;

      // Only show if product is at least 24 hours old (give time to set up)
      if (productCreatedAt) {
        const ageMs = Date.now() - new Date(productCreatedAt).getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (ageMs < twentyFourHours) return false;
      }

      return true;
    },
  },

  // -------------------------------------------------------------------------
  // Knowledge Source Notifications (Warning - cannot dismiss)
  // -------------------------------------------------------------------------
  {
    config: {
      type: 'no_knowledge_sources',
      severity: 'warning',
      title: 'No Knowledge Sources',
      message: 'Add a knowledge source to power your AI assistant.',
      action: {
        label: 'Add Source',
        href: '/knowledge',
      },
    },
    condition: ({ sources, isLoading }) => {
      if (isLoading) return false;
      return sources.length === 0;
    },
  },
  {
    config: {
      type: 'empty_crawl',
      severity: 'warning',
      title: 'No Content Indexed',
      message: 'Your knowledge sources have no content. Start a crawl to index your docs.',
      action: {
        label: 'View Sources',
        href: '/knowledge',
      },
    },
    condition: ({ sources, isLoading }) => {
      if (isLoading) return false;
      if (sources.length === 0) return false; // Handled by no_knowledge_sources
      
      const totalItems = sources.reduce((sum, s) => sum + (s.item_count || 0), 0);
      const hasRunningSyncs = sources.some((s) => s.status === 'syncing');
      
      return totalItems === 0 && !hasRunningSyncs;
    },
  },

  // -------------------------------------------------------------------------
  // Setup Incomplete (Info - dismissible, 7-day snooze)
  // -------------------------------------------------------------------------
  {
    config: {
      type: 'setup_incomplete',
      severity: 'info',
      title: 'Finish Setting Up Pillar',
      message: 'Complete the setup guide to start using your AI assistant.',
      action: {
        label: 'Continue Setup',
        href: '/onboarding',
      },
      dismissDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    condition: ({ sources, integrationStatus, productCreatedAt, isLoading }) => {
      if (isLoading) return false;
      if (!integrationStatus) return false;

      // Only show if user has started onboarding (has at least one source)
      if (sources.length === 0) return false;

      // Setup is complete once actions are registered
      if (integrationStatus.actions_registered) return false;

      // If SDK isn't initialized, only show this info banner during the
      // 24h grace period. After that (or if we have no creation date),
      // the critical "sdk_not_initialized" banner handles it instead.
      if (!integrationStatus.sdk_initialized) {
        if (!productCreatedAt) return false;
        const ageMs = Date.now() - new Date(productCreatedAt).getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (ageMs >= twentyFourHours) return false;
      }

      return true;
    },
  },

  // -------------------------------------------------------------------------
  // Free Plan Upgrade (Info - persistent, cannot dismiss)
  // -------------------------------------------------------------------------
  {
    config: {
      type: 'free_plan_upgrade',
      severity: 'info',
      title: "You're on the Free plan",
      message: 'Upgrade to unlock more responses and advanced features.',
      action: {
        label: 'Upgrade',
        href: '/billing',
      },
      dismissible: false,
    },
    condition: ({ organizationPlan, isLoading }) => {
      if (isLoading) return false;
      return organizationPlan === 'free';
    },
  },

  // -------------------------------------------------------------------------
  // Add new notifications above this line
  // -------------------------------------------------------------------------
];

// ============================================================================
// Helper to get all notification types (for TypeScript)
// ============================================================================

export type RegisteredNotificationType = typeof NOTIFICATION_REGISTRY[number]['config']['type'];
