'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProduct } from './ProductProvider';
import { useOrganization } from './OrganizationProvider';
import { knowledgeSourceListQuery } from '@/queries/sources.queries';
import { productIntegrationStatusQuery } from '@/queries/v2/products.queries';
import {
  NOTIFICATION_REGISTRY,
  type NotificationContext,
} from '@/lib/notifications/notification-registry';
import type {
  SystemNotification,
  NotificationSeverity,
  DismissedNotifications,
} from '@/types/notifications';
import {
  DISMISS_DURATIONS,
  DISMISSED_NOTIFICATIONS_KEY,
} from '@/types/notifications';

// ============================================================================
// Context Types
// ============================================================================

interface SystemNotificationContextValue {
  /** All active (non-dismissed) notifications, sorted by priority */
  notifications: SystemNotification[];
  /** The highest priority notification to display */
  activeNotification: SystemNotification | null;
  /** Number of additional notifications after the active one */
  remainingCount: number;
  /** Dismiss a notification (if dismissible) */
  dismissNotification: (type: string) => void;
}

const SystemNotificationContext = createContext<SystemNotificationContextValue | undefined>(
  undefined
);

// ============================================================================
// Hook
// ============================================================================

export function useSystemNotifications(): SystemNotificationContextValue {
  const context = useContext(SystemNotificationContext);
  if (!context) {
    throw new Error(
      'useSystemNotifications must be used within a SystemNotificationProvider'
    );
  }
  return context;
}

// ============================================================================
// Helper Functions
// ============================================================================

function loadDismissedNotifications(): DismissedNotifications {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as DismissedNotifications;
  } catch {
    return {};
  }
}

function saveDismissedNotifications(dismissed: DismissedNotifications): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(dismissed));
}

function isNotificationDismissed(
  type: string,
  dismissed: DismissedNotifications
): boolean {
  const expiry = dismissed[type];
  if (!expiry) return false;
  return Date.now() < expiry;
}

/** Priority order: critical (0) > warning (1) > info (2) */
const SEVERITY_PRIORITY: Record<NotificationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function sortByPriority(notifications: SystemNotification[]): SystemNotification[] {
  return [...notifications].sort(
    (a, b) => SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity]
  );
}

/**
 * Determine if a notification is dismissible based on severity.
 * Only info notifications can be dismissed by default.
 * Critical/warning must be resolved to disappear.
 */
function isDismissible(severity: NotificationSeverity, explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  return severity === 'info';
}

// ============================================================================
// Provider
// ============================================================================

interface SystemNotificationProviderProps {
  children: ReactNode;
}

/**
 * System notification provider.
 * 
 * Evaluates notifications from the centralized registry and shows
 * one at a time, sorted by priority (critical > warning > info).
 * 
 * To add new notifications, edit: lib/notifications/notification-registry.ts
 */
export function SystemNotificationProvider({
  children,
}: SystemNotificationProviderProps) {
  const { currentProductId, currentProduct, isLoading: isProductLoading } = useProduct();
  const { currentOrganization } = useOrganization();

  // Dismissed notifications state (persisted in localStorage)
  const [dismissed, setDismissed] = useState<DismissedNotifications>(() =>
    loadDismissedNotifications()
  );

  // -------------------------------------------------------------------------
  // Data Queries
  // -------------------------------------------------------------------------

  const { data: sourcesData, isLoading: isSourcesLoading } = useQuery({
    ...knowledgeSourceListQuery(),
    enabled: !!currentProductId,
  });

  const { data: integrationStatus, isLoading: isIntegrationLoading } = useQuery({
    ...productIntegrationStatusQuery(currentProductId || ''),
    enabled: !!currentProductId,
    refetchInterval: false,
  });

  // -------------------------------------------------------------------------
  // Build Notifications from Registry
  // -------------------------------------------------------------------------

  const notifications = useMemo(() => {
    // Build context for condition evaluation
    const context: NotificationContext = {
      sources: sourcesData?.results || [],
      integrationStatus: integrationStatus || null,
      productCreatedAt: (currentProduct?.config?.created_at as string) || null,
      isLoading: isProductLoading || isSourcesLoading || isIntegrationLoading,
      organizationPlan: currentOrganization?.plan ?? null,
    };

    // Evaluate each rule in the registry
    const active: SystemNotification[] = [];
    
    for (const rule of NOTIFICATION_REGISTRY) {
      // Check if condition is met
      if (!rule.condition(context)) continue;

      const { config } = rule;
      const dismissible = isDismissible(config.severity, config.dismissible);

      // Skip if dismissed (unless not dismissible)
      if (dismissible && isNotificationDismissed(config.type, dismissed)) {
        continue;
      }

      active.push({
        id: config.type,
        type: config.type,
        severity: config.severity,
        title: config.title,
        message: config.message,
        action: config.action,
        dismissible,
        dismissDuration: config.dismissDuration,
      });
    }

    return sortByPriority(active);
  }, [
    sourcesData,
    integrationStatus,
    currentProduct,
    currentOrganization,
    isProductLoading,
    isSourcesLoading,
    isIntegrationLoading,
    dismissed,
  ]);

  // -------------------------------------------------------------------------
  // Derived State
  // -------------------------------------------------------------------------

  const activeNotification = notifications[0] || null;
  const remainingCount = Math.max(0, notifications.length - 1);

  // -------------------------------------------------------------------------
  // Dismiss Handler
  // -------------------------------------------------------------------------

  const dismissNotification = useCallback(
    (type: string) => {
      const notification = notifications.find((n) => n.type === type);
      if (!notification?.dismissible) return;

      const duration = notification.dismissDuration || DISMISS_DURATIONS.SHORT;
      const expiry = Date.now() + duration;

      setDismissed((prev) => {
        const updated = { ...prev, [type]: expiry };
        saveDismissedNotifications(updated);
        return updated;
      });
    },
    [notifications]
  );

  // -------------------------------------------------------------------------
  // Context Value
  // -------------------------------------------------------------------------

  const contextValue = useMemo(
    () => ({
      notifications,
      activeNotification,
      remainingCount,
      dismissNotification,
    }),
    [notifications, activeNotification, remainingCount, dismissNotification]
  );

  return (
    <SystemNotificationContext.Provider value={contextValue}>
      {children}
    </SystemNotificationContext.Provider>
  );
}
