'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { 
  FileText, 
  Tag, 
  Copy, 
  Camera, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentActivityItem, AgentType } from '@/types/admin';
import { cn } from '@/lib/utils';

interface AgentActivityFeedProps {
  activities: AgentActivityItem[];
  agentType?: AgentType;
  maxItems?: number;
  showHeader?: boolean;
}

const actionIcons: Record<string, React.ElementType> = {
  'Categorized article': Tag,
  'Found duplicate': Copy,
  'Added related links': FileText,
  'Processed import': CheckCircle,
  'Created draft': FileText,
  'Flagged stale content': AlertTriangle,
  'Screenshot refresh': Camera,
  'Changelog detected': AlertTriangle,
  'Full check completed': CheckCircle,
};

const colorByAgent: Record<AgentType, string> = {
  librarian: 'text-cyan-500 bg-cyan-500/10',
  drafter: 'text-rose-500 bg-rose-500/10',
  gardener: 'text-emerald-500 bg-emerald-500/10',
};

export function AgentActivityFeed({ 
  activities, 
  agentType,
  maxItems = 10,
  showHeader = true 
}: AgentActivityFeedProps) {
  const filteredActivities = agentType 
    ? activities.filter(a => a.agentType === agentType)
    : activities;
  
  const displayActivities = filteredActivities.slice(0, maxItems);

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(!showHeader && 'pt-6')}>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
          
          {/* Activity items */}
          <ul className="space-y-4">
            {displayActivities.map((activity, index) => {
              const IconComponent = actionIcons[activity.action] || FileText;
              const colors = colorByAgent[activity.agentType];
              
              return (
                <li 
                  key={activity.id}
                  className="relative pl-10 animate-in fade-in slide-in-from-left-2"
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: 'backwards'
                  }}
                >
                  {/* Icon circle */}
                  <div 
                    className={cn(
                      'absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full',
                      colors
                    )}
                  >
                    <IconComponent className="h-4 w-4" />
                  </div>
                  
                  {/* Content */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{activity.action}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {activity.articleId ? (
                        <Link 
                          href={`/admin/content/${activity.articleId}`}
                          className="hover:text-foreground hover:underline transition-colors"
                        >
                          {activity.description}
                        </Link>
                      ) : (
                        activity.description
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {displayActivities.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No activity yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


