'use client';

import { AlertTriangle, Info, XCircle, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SystemNotification, NotificationSeverity } from '@/types/notifications';

// ============================================================================
// Styling Configuration
// ============================================================================

/**
 * Severity styles:
 * - critical: Red. Cannot be dismissed. Must be resolved.
 * - warning: Amber. Can be dismissed. Primary for onboarding.
 * - info: Blue. Can be dismissed. For tips/marketing.
 */
const severityStyles: Record<
  NotificationSeverity,
  {
    container: string;
    icon: string;
    text: string;
    actionButton: string;
    dismissButton: string;
    muted: string;
  }
> = {
  critical: {
    container: 'bg-destructive/10 border-destructive/30',
    icon: 'text-destructive',
    text: 'text-destructive',
    actionButton: 'border border-destructive/50 text-destructive hover:bg-destructive/20',
    dismissButton: 'text-destructive hover:bg-destructive/20',
    muted: 'text-destructive/60',
  },
  warning: {
    container: 'bg-amber-500/10 border-amber-500/30',
    icon: 'text-amber-600 dark:text-amber-500',
    text: 'text-amber-800 dark:text-amber-200',
    actionButton: 'border border-amber-600/50 dark:border-amber-400/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20',
    dismissButton: 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/20',
    muted: 'text-amber-600/60 dark:text-amber-400/60',
  },
  info: {
    container: 'bg-blue-500/10 border-blue-500/30',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-800 dark:text-blue-200',
    actionButton: 'border border-blue-600/50 dark:border-blue-400/50 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20',
    dismissButton: 'text-blue-700 dark:text-blue-300 hover:bg-blue-500/20',
    muted: 'text-blue-600/60 dark:text-blue-400/60',
  },
};

export { severityStyles };

const severityIcons: Record<NotificationSeverity, typeof AlertTriangle> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
};

// ============================================================================
// Props
// ============================================================================

interface SystemBannerItemProps {
  notification: SystemNotification;
  onDismiss?: () => void;
  /** Optional trailing element (e.g., expand/collapse trigger) */
  trailing?: ReactNode;
  /** If true, removes the bottom border (for stacked items) */
  noBorder?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SystemBannerItem({
  notification,
  onDismiss,
  trailing,
  noBorder = false,
}: SystemBannerItemProps) {
  const styles = severityStyles[notification.severity];
  const Icon = severityIcons[notification.severity];

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2',
        !noBorder && 'border-b',
        styles.container
      )}
      role="alert"
    >
      {/* Left: Icon + Content (truncates) */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon className={cn('h-4 w-4 shrink-0', styles.icon)} />
        <span className={cn('font-medium text-sm whitespace-nowrap', styles.text)}>
          {notification.title}
        </span>
        <span className={cn('text-sm opacity-80 truncate hidden md:inline', styles.text)}>
          — {notification.message}
        </span>
      </div>

      {/* Right: Action + Dismiss + Trailing */}
      <div className="flex items-center gap-1 shrink-0">
        {notification.action && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn('h-7 px-3 text-xs font-medium whitespace-nowrap rounded-md', styles.actionButton)}
          >
            <Link href={notification.action.href}>
              {notification.action.label}
            </Link>
          </Button>
        )}
        {notification.dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className={cn('h-7 w-7 shrink-0', styles.dismissButton)}
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {trailing}
      </div>
    </div>
  );
}
