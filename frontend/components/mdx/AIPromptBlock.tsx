'use client';

import { useState } from 'react';
import { ChevronDown, Copy, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Dynamic loading of prompt examples using webpack's require.context.
 * Prompt files use .txt extension to avoid TypeScript compilation.
 * 
 * To add a new prompt:
 * Simply create the file in examples/prompts/ with .md.txt extension
 * (e.g., examples/prompts/build-actions.md.txt)
 */
const promptContext = require.context('@/examples/prompts', false, /\.txt$/);
const PROMPT_EXAMPLES: Record<string, string> = {};
promptContext.keys().forEach((key) => {
  // Transform './build-actions.md.txt' -> 'build-actions.md'
  const normalizedKey = key.replace(/^\.\//, '').replace(/\.txt$/, '');
  const content = promptContext<{ default?: string } | string>(key);
  PROMPT_EXAMPLES[normalizedKey] = typeof content === 'string' ? content : (content.default || '');
});

interface AIPromptBlockProps {
  title: string;
  /** Inline content (children) or path to external file (src) */
  children?: React.ReactNode;
  /** Path relative to examples/prompts/ (without .txt suffix), e.g., "build-actions.md" */
  src?: string;
}

/**
 * A collapsible block for AI prompts that can be copied to Cursor or Claude.
 * Collapsed by default with a branded header and copy functionality.
 * 
 * Usage in MDX:
 * - Inline: <AIPromptBlock title="...">{`prompt content`}</AIPromptBlock>
 * - External: <AIPromptBlock title="..." src="build-actions.md" />
 */
export function AIPromptBlock({ title, children, src }: AIPromptBlockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load content from file if src provided, otherwise use children
  const content = src ? PROMPT_EXAMPLES[src] : children;

  // Show error if src specified but file not found
  if (src && !PROMPT_EXAMPLES[src]) {
    console.warn(`AIPromptBlock: No prompt found for "${src}"`);
    return (
      <div className="bg-red-900/20 text-red-400 p-4 rounded-lg my-3 text-sm">
        Prompt not found: <code>examples/prompts/{src}</code>
      </div>
    );
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggle when clicking copy
    
    // Extract text content from children or use loaded content
    const text = typeof content === 'string' 
      ? content 
      : extractTextFromChildren(content);
    
    await navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 overflow-hidden">
      {/* Header - always visible */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-primary/5 transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">{title}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors',
              copied
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            )}
            aria-label={copied ? 'Copied!' : 'Copy prompt'}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copy for Cursor / Claude / AI Coding</span>
                <span className="sm:hidden">Copy</span>
              </>
            )}
          </button>
          
          {/* Expand/collapse chevron */}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>

      {/* Plan mode tip */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground border-t border-primary/10 px-4 py-2 bg-primary/5">
        <span>Tip: Use</span>
        <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">⌘</kbd>
        <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">.</kbd>
        <span>to enable <strong className="font-semibold">Plan mode</strong> in Cursor for best results</span>
      </div>

      {/* Collapsible content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="border-t border-primary/10 px-4 py-4">
          <div className="rounded-md bg-zinc-900 dark:bg-zinc-950 p-4 overflow-x-auto">
            <pre className="text-sm text-zinc-100 whitespace-pre-wrap font-mono leading-relaxed">
              {content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to extract text content from React children
 */
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }
  
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }
  
  if (children && typeof children === 'object' && 'props' in children) {
    const element = children as React.ReactElement<{ children?: React.ReactNode }>;
    return extractTextFromChildren(element.props.children);
  }
  
  return '';
}
