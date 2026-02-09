'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { KnowledgeSourceStatus } from '@/types/sources';

interface SyncStatusBadgeProps {
  status: KnowledgeSourceStatus;
  className?: string;
}

const statusConfig: Record<KnowledgeSourceStatus, { label: string; className: string; showSpinner?: boolean }> = {
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  syncing: {
    label: 'Syncing',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    showSpinner: true,
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  paused: {
    label: 'Paused',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
};

export function SyncStatusBadge({ status, className }: SyncStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.showSpinner && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {config.label}
    </span>
  );
}
