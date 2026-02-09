'use client';

import { usePillarContext } from '@pillar-ai/react';
import { PanelRight, MessageSquare, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DemoCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  isActive?: boolean;
}

function DemoCard({ icon, title, description, onClick, isActive }: DemoCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col items-start gap-3 p-4 rounded-lg border transition-all duration-200',
        'bg-card hover:bg-accent/50 hover:border-primary/30',
        'text-left w-full',
        isActive && 'border-primary bg-primary/5'
      )}
    >
      <div
        className={cn(
          'p-2 rounded-md transition-colors',
          'bg-primary/10 text-primary group-hover:bg-primary/20',
          isActive && 'bg-primary text-primary-foreground'
        )}
      >
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </button>
  );
}

/**
 * Interactive demo component that lets users try the Pillar SDK features
 * directly on the docs site.
 */
export function InteractiveDemo() {
  const { open, search, isPanelOpen, isReady } = usePillarContext();

  if (!isReady) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 rounded-lg border bg-muted/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="my-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DemoCard
          icon={<PanelRight className="h-5 w-5" />}
          title="Open Help Panel"
          description="See the slide-out panel with AI chat and help articles"
          onClick={() => open()}
          isActive={isPanelOpen}
        />
        <DemoCard
          icon={<MessageSquare className="h-5 w-5" />}
          title="Try AI Chat"
          description="Ask a question and see how the AI assistant responds"
          onClick={() => open({ focusInput: true })}
        />
        <DemoCard
          icon={<Search className="h-5 w-5" />}
          title="Search Articles"
          description="Try searching for help articles in the panel"
          onClick={() => search('getting started')}
        />
      </div>
    </div>
  );
}
