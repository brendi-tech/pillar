'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useSystemNotifications } from '@/providers/SystemNotificationProvider';
import { SystemBannerItem, severityStyles } from './SystemBannerItem';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Component
// ============================================================================

/**
 * System banner with expandable stack.
 * 
 * Display rules:
 * - Collapsed: Shows highest priority notification + "▼ X more" trigger
 * - Expanded: Shows all notifications stacked + "▲ Collapse" trigger
 * - Critical notifications cannot be dismissed
 * - Warning/info can be dismissed
 */
export function SystemBanner() {
  const {
    notifications,
    activeNotification,
    remainingCount,
    dismissNotification,
  } = useSystemNotifications();

  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render anything if no notifications
  if (!activeNotification) {
    return null;
  }

  // Get styles from the active (primary) notification for the expand trigger
  const primaryStyles = severityStyles[activeNotification.severity];

  // Expand/collapse trigger button
  const expandTrigger = remainingCount > 0 && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        'h-7 px-2 text-xs font-medium whitespace-nowrap gap-1',
        primaryStyles.dismissButton
      )}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? 'Collapse notifications' : `Show ${remainingCount} more notifications`}
    >
      {isExpanded ? (
        <>
          <ChevronUp className="h-3 w-3" />
          <span className="hidden sm:inline">Collapse</span>
        </>
      ) : (
        <>
          <ChevronDown className="h-3 w-3" />
          <span>{remainingCount} more</span>
        </>
      )}
    </Button>
  );

  // Collapsed: show only the primary notification
  if (!isExpanded) {
    return (
      <SystemBannerItem
        notification={activeNotification}
        onDismiss={
          activeNotification.dismissible
            ? () => dismissNotification(activeNotification.type)
            : undefined
        }
        trailing={expandTrigger}
      />
    );
  }

  // Expanded: show all notifications stacked
  return (
    <div className="flex flex-col">
      {notifications.map((notification, index) => {
        const isLast = index === notifications.length - 1;
        
        return (
          <SystemBannerItem
            key={notification.id}
            notification={notification}
            onDismiss={
              notification.dismissible
                ? () => dismissNotification(notification.type)
                : undefined
            }
            // Show collapse trigger on the first item only
            trailing={index === 0 ? expandTrigger : undefined}
            // Remove border on last item (parent container will handle)
            noBorder={isLast}
          />
        );
      })}
    </div>
  );
}
