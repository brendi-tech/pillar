'use client';

import { cn } from '@/lib/utils';
import type { AgentStatus } from '@/types/admin';

interface AgentStatusBadgeProps {
  status: AgentStatus;
  className?: string;
  showLabel?: boolean;
}

const statusConfig: Record<AgentStatus, { label: string; className: string; dotClassName: string }> = {
  idle: {
    label: 'Idle',
    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    dotClassName: 'bg-zinc-400',
  },
  active: {
    label: 'Active',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dotClassName: 'bg-emerald-400',
  },
  running: {
    label: 'Running',
    className: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    dotClassName: 'bg-sky-400 animate-pulse',
  },
  paused: {
    label: 'Paused',
    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    dotClassName: 'bg-zinc-400',
  },
  error: {
    label: 'Error',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    dotClassName: 'bg-red-400',
  },
};

export function AgentStatusBadge({ status, className, showLabel = true }: AgentStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
        config.className,
        className
      )}
    >
      <span 
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          config.dotClassName
        )} 
      />
      {showLabel && config.label}
    </span>
  );
}


