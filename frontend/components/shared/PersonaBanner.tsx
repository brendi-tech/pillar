'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Persona } from '@/types';

interface PersonaBannerProps {
  persona: Persona;
  className?: string;
}

/**
 * Banner shown at the top of pages when viewing through a persona filter.
 * 
 * Shows the current persona context with a link to clear the filter
 * and view all content.
 */
export function PersonaBanner({ persona, className }: PersonaBannerProps) {
  return (
    <div 
      className={cn(
        'bg-primary/10 border-b border-primary/20',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Viewing help for:</span>{' '}
            <strong className="font-semibold">{persona.name}</strong>
          </p>
          
          <Link 
            href="/"
            className={cn(
              'inline-flex items-center gap-1.5',
              'text-sm text-muted-foreground hover:text-foreground',
              'transition-colors'
            )}
          >
            <span>View all content</span>
            <X className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for use in header or breadcrumbs.
 */
export function PersonaBadge({ persona }: { persona: Persona }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
      {persona.name}
    </span>
  );
}

