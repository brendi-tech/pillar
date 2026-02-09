'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { BookOpen, Pencil, Leaf, ArrowRight, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AgentStatusBadge } from './AgentStatusBadge';
import type { AgentOverview } from '@/types/admin';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: AgentOverview;
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
    glow: 'group-hover:shadow-cyan-500/10',
    gradient: 'from-cyan-500/5 to-transparent',
  },
  rose: {
    border: 'border-l-rose-500',
    bg: 'bg-rose-500/10 dark:bg-rose-950/50',
    icon: 'text-rose-500',
    glow: 'group-hover:shadow-rose-500/10',
    gradient: 'from-rose-500/5 to-transparent',
  },
  emerald: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/50',
    icon: 'text-emerald-500',
    glow: 'group-hover:shadow-emerald-500/10',
    gradient: 'from-emerald-500/5 to-transparent',
  },
};

export function AgentCard({ agent }: AgentCardProps) {
  const Icon = iconMap[agent.icon as keyof typeof iconMap] || BookOpen;
  const colors = colorConfig[agent.color];

  return (
    <Link href={`/admin/agents/${agent.id}`}>
      <Card 
        className={cn(
          'group relative overflow-hidden border-l-4 transition-all duration-300',
          'hover:scale-[1.02] hover:shadow-xl',
          colors.border,
          colors.glow
        )}
      >
        {/* Subtle gradient overlay */}
        <div 
          className={cn(
            'absolute inset-0 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100',
            colors.gradient
          )} 
        />
        
        <CardContent className="relative pt-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('rounded-xl p-2.5', colors.bg)}>
                <Icon className={cn('h-5 w-5', colors.icon)} />
              </div>
              <div>
                <p className={cn('text-xs font-bold uppercase tracking-wider', colors.icon)}>
                  {agent.name}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {agent.tagline}
                </p>
              </div>
            </div>
            <AgentStatusBadge status={agent.status} />
          </div>

          {/* Description */}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {agent.description}
          </p>

          {/* Last Run */}
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {agent.lastRunAt 
                ? `Last run ${formatDistanceToNow(new Date(agent.lastRunAt), { addSuffix: true })}`
                : 'Never run'
              }
            </span>
          </div>

          {/* Recent Activity */}
          {agent.recentActivity.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Recent:</p>
              <ul className="space-y-1">
                {agent.recentActivity.slice(0, 3).map((activity, index) => (
                  <li 
                    key={index}
                    className="text-xs text-muted-foreground/80 flex items-start gap-2"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="line-clamp-1">{activity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pending Actions & CTA */}
          <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-4">
            {agent.pendingActions > 0 && (
              <span className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                colors.bg,
                colors.icon
              )}>
                {agent.pendingActions} pending
              </span>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-auto gap-1 text-xs group-hover:translate-x-0.5 transition-transform"
            >
              View Details
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Runs On */}
          <p className="mt-3 text-[11px] text-muted-foreground/60 font-mono">
            Runs on: {agent.runsOn}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}


