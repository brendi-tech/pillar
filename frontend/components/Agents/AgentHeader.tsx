'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, BookOpen, Pencil, Leaf, Clock, Play, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgentStatusBadge } from './AgentStatusBadge';
import type { AgentOverview } from '@/types/admin';
import { cn } from '@/lib/utils';

interface AgentHeaderProps {
  agent: AgentOverview;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const iconMap = {
  BookOpen,
  Pencil,
  Leaf,
};

const colorConfig = {
  cyan: {
    bg: 'bg-cyan-500/10 dark:bg-cyan-950/50',
    icon: 'text-cyan-500',
    text: 'text-cyan-500',
    gradient: 'from-cyan-500/10 via-transparent to-transparent',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-950/50',
    icon: 'text-rose-500',
    text: 'text-rose-500',
    gradient: 'from-rose-500/10 via-transparent to-transparent',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/50',
    icon: 'text-emerald-500',
    text: 'text-emerald-500',
    gradient: 'from-emerald-500/10 via-transparent to-transparent',
  },
};

export function AgentHeader({ agent, primaryAction, secondaryAction }: AgentHeaderProps) {
  const Icon = iconMap[agent.icon as keyof typeof iconMap] || BookOpen;
  const colors = colorConfig[agent.color];

  return (
    <div className="relative">
      {/* Background gradient */}
      <div 
        className={cn(
          'absolute inset-0 bg-gradient-to-r opacity-50',
          colors.gradient
        )} 
      />
      
      <div className="relative space-y-4">
        {/* Back link */}
        <Link 
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Agents
        </Link>

        {/* Main header content */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Agent icon */}
            <div className={cn('rounded-2xl p-4', colors.bg)}>
              <Icon className={cn('h-8 w-8', colors.icon)} />
            </div>

            {/* Agent info */}
            <div>
              <div className="flex items-center gap-3">
                <h1 className={cn('text-2xl font-bold tracking-tight', colors.text)}>
                  {agent.name}
                </h1>
                <AgentStatusBadge status={agent.status} />
              </div>
              
              <p className="mt-1 text-muted-foreground">
                {agent.tagline}
              </p>

              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {agent.lastRunAt 
                    ? `Last run ${formatDistanceToNow(new Date(agent.lastRunAt), { addSuffix: true })}`
                    : 'Never run'
                  }
                </span>
                {agent.pendingActions > 0 && (
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    colors.bg,
                    colors.text
                  )}>
                    {agent.pendingActions} pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {secondaryAction && (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                <Settings className="mr-2 h-4 w-4" />
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                {primaryAction.icon || <Play className="mr-2 h-4 w-4" />}
                {primaryAction.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


