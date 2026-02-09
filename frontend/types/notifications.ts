/**
 * System notification types for persistent banners.
 * 
 * Notifications are defined in: lib/notifications/notification-registry.ts
 */

/**
 * Notification severity levels determine display behavior:
 *
 * - **critical**: Cannot be dismissed. Always ranks first and must be shown
 *   until resolved (e.g., billing failure, account suspension). No X button.
 *   Use sparingly for truly blocking issues.
 *
 * - **warning**: Cannot be dismissed. Used for onboarding guidance and
 *   actionable items that need attention. Must be resolved to disappear.
 *   Primary severity for most system notifications.
 *
 * - **info**: Can be dismissed (7d default). Lowest priority. Used for tips,
 *   feature announcements, or marketing messages. Shows X button.
 */
export type NotificationSeverity = 'critical' | 'warning' | 'info';

/**
 * Built notification ready for display.
 * Created from NotificationConfig in the registry.
 */
export interface SystemNotification {
  /** Unique identifier (same as type) */
  id: string;
  /** Type of notification - used for dismissal tracking */
  type: string;
  /** Severity level affects styling and dismissibility */
  severity: NotificationSeverity;
  /** Short title displayed prominently */
  title: string;
  /** Longer description message */
  message: string;
  /** Optional call-to-action */
  action?: {
    label: string;
    href: string;
  };
  /** Whether the user can dismiss this notification */
  dismissible: boolean;
  /** How long (in ms) the notification stays dismissed after user dismisses it */
  dismissDuration?: number;
}

export interface DismissedNotifications {
  /** Map of notification type to timestamp when dismissal expires */
  [key: string]: number;
}

/** Dismissal durations in milliseconds */
export const DISMISS_DURATIONS = {
  /** 24 hours */
  SHORT: 24 * 60 * 60 * 1000,
  /** 7 days */
  LONG: 7 * 24 * 60 * 60 * 1000,
  /** 1 day */
  DAY: 24 * 60 * 60 * 1000,
} as const;

/** localStorage key for dismissed notifications */
export const DISMISSED_NOTIFICATIONS_KEY = 'pillar_dismissed_notifications';
