'use client';

import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight, ExternalLink, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import type { MessageCorrection } from '@/types/admin';
import { cn } from '@/lib/utils';

interface ExistingCorrectionDisplayProps {
  correction: MessageCorrection;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  processed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  indexed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export function ExistingCorrectionDisplay({ correction }: ExistingCorrectionDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-1.5">
      <CollapsibleTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-violet-200/50 dark:border-violet-800/30 bg-violet-50/50 dark:bg-violet-950/20 px-2 py-1 text-[11px] text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100/50 dark:hover:bg-violet-900/30">
          {isOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          <Wand2 className="h-2.5 w-2.5" />
          <span className="font-medium">Correction</span>
          <span className={cn('rounded px-1 py-px text-[9px]', statusColors[correction.status] || statusColors.pending)}>
            {correction.status}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5">
        <div className="rounded-md border border-violet-200/50 dark:border-violet-800/30 bg-violet-50/30 dark:bg-violet-950/10 p-2.5 space-y-2">
          {correction.processed_title && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Knowledge Created</p>
              {correction.knowledge_item && correction.knowledge_item_source_id ? (
                <Link
                  href={`/knowledge/${correction.knowledge_item_source_id}/${correction.knowledge_item}`}
                  className="text-xs font-medium text-primary hover:underline underline-offset-2 flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {correction.processed_title}
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              ) : (
                <p className="text-xs font-medium text-foreground">{correction.processed_title}</p>
              )}
              {correction.processed_content && (
                <MarkdownRenderer
                  content={correction.processed_content}
                  className="text-[11px] text-muted-foreground mt-1 prose-p:my-0 prose-p:leading-relaxed line-clamp-4"
                />
              )}
            </div>
          )}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Original Feedback</p>
            <p className="text-[11px] text-foreground/80 whitespace-pre-wrap">{correction.user_correction_notes}</p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Created {formatDistanceToNow(new Date(correction.created_at), { addSuffix: true })}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
