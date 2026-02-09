'use client';

import { useState } from 'react';
import { usePillarContext } from '@pillar-ai/react';
import { ChevronDown, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

type TryAction = 'openPanel' | 'openChat' | 'search';

interface FeatureItemProps {
  title: string;
  description: string;
  screenshot?: string;
  tryAction?: TryAction;
  children?: React.ReactNode;
}

export function FeatureItem({
  title,
  description,
  screenshot,
  tryAction,
  children,
}: FeatureItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { open, search, isReady } = usePillarContext();

  const handleTryAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isReady) return;

    switch (tryAction) {
      case 'openPanel':
        open();
        break;
      case 'openChat':
        open({ focusInput: true });
        break;
      case 'search':
        search('getting started');
        break;
    }
  };

  const tryActionLabels: Record<TryAction, string> = {
    openPanel: 'Open Panel',
    openChat: 'Try AI Chat',
    search: 'Try Search',
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={isOpen}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
        <span className="font-medium text-foreground">{title}</span>
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/30">
          {description && (
            <p className="text-sm text-muted-foreground mb-3">
              {description}
            </p>
          )}

          {screenshot && (
            <div className="rounded-lg overflow-hidden border border-border bg-background mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt={`${title} screenshot`}
                className="w-full h-auto"
              />
            </div>
          )}

          {children && (
            <div className="text-sm text-muted-foreground">
              {children}
            </div>
          )}

          {tryAction && isReady && (
            <button
              onClick={handleTryAction}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors mt-3',
                'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <Play className="h-3.5 w-3.5" />
              {tryActionLabels[tryAction]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface FeatureShowcaseProps {
  children: React.ReactNode;
  className?: string;
}

export function FeatureShowcase({ children, className }: FeatureShowcaseProps) {
  return (
    <div className={cn('space-y-2 my-6', className)}>
      {children}
    </div>
  );
}
