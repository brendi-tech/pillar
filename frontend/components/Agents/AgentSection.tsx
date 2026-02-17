'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  BookOpen,
  Pencil,
  Leaf,
  ChevronDown,
  ChevronUp,
  Play,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AgentStatusBadge } from './AgentStatusBadge';
import type { AgentOverview } from '@/types/admin';
import { cn } from '@/lib/utils';

interface AgentSectionProps {
  agent: AgentOverview;
  defaultExpanded?: boolean;
  onRun?: () => void;
  isRunning?: boolean;
  children?: React.ReactNode;
}

const iconMap = {
  BookOpen,
  Pencil,
  Leaf,
};

const colorConfig = {
  cyan: {
    border: 'border-l-cyan-500',
    bg: 'bg-cyan-500/10 dark:bg-cyan-950/50',
    icon: 'text-cyan-500',
    expandedBg: 'bg-cyan-500/5',
    statBg: 'bg-cyan-500/10',
  },
  rose: {
    border: 'border-l-rose-500',
    bg: 'bg-rose-500/10 dark:bg-rose-950/50',
    icon: 'text-rose-500',
    expandedBg: 'bg-rose-500/5',
    statBg: 'bg-rose-500/10',
  },
  emerald: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/50',
    icon: 'text-emerald-500',
    expandedBg: 'bg-emerald-500/5',
    statBg: 'bg-emerald-500/10',
  },
};

export function AgentSection({
  agent,
  defaultExpanded = false,
  onRun,
  isRunning = false,
  children
}: AgentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const Icon = iconMap[agent.icon as keyof typeof iconMap] || BookOpen;
  const colors = colorConfig[agent.color];

  return (
    <Card className={cn(
      'border-l-4 overflow-hidden transition-all duration-300',
      colors.border
    )}>
      <CardContent className="p-0">
        {/* Header Section - Always visible */}
        <div className="p-5">
          {/* Top row: Icon, Title, Status, Actions */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn('rounded-xl p-2.5 shrink-0', colors.bg)}>
                <Icon className={cn('h-5 w-5', colors.icon)} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={cn('font-bold text-sm uppercase tracking-wider', colors.icon)}>
                    {agent.name}
                  </h3>
                  <AgentStatusBadge status={agent.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {agent.tagline}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={onRun}
                disabled={isRunning || agent.status === 'running'}
                className="gap-1.5"
              >
                {isRunning || agent.status === 'running' ? (
                  <Spinner size="xs" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run
              </Button>
            </div>
          </div>

          {/* Meta row: Last run, Pending */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {agent.lastRunAt
                  ? `Last run ${formatDistanceToNow(new Date(agent.lastRunAt), { addSuffix: true })}`
                  : 'Never run'
                }
              </span>
            </div>
            {agent.pendingActions > 0 && (
              <span className={cn(
                'rounded-full px-2 py-0.5 font-medium',
                colors.statBg,
                colors.icon
              )}>
                {agent.pendingActions} pending
              </span>
            )}
            <span className="text-muted-foreground/60 font-mono text-[11px]">
              Runs on: {agent.runsOn}
            </span>
          </div>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'mt-4 flex items-center gap-1.5 text-sm font-medium transition-colors',
              colors.icon,
              'hover:opacity-80'
            )}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show Details
              </>
            )}
          </button>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className={cn(
            'border-t border-border/50 p-5 animate-in slide-in-from-top-2 duration-300',
            colors.expandedBg
          )}>
            {children}

            {/* Link to full page */}
            <div className="mt-4 pt-4 border-t border-border/30">
              <Link
                href={`/admin/agents/${agent.id}`}
                className={cn(
                  'inline-flex items-center gap-1.5 text-sm font-medium transition-colors',
                  colors.icon,
                  'hover:opacity-80'
                )}
              >
                Open Full Page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
