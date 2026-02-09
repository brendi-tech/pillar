'use client';

import { useState, useEffect, useCallback } from 'react';
import { SyntaxHighlightedPre } from './SyntaxHighlightedPre';
import { cn } from '@/lib/utils';

// localStorage key for persisting language preference
const LANGUAGE_PREFERENCE_KEY = 'pillar-docs-code-language';

// Custom event name for syncing across components
const LANGUAGE_CHANGE_EVENT = 'pillar-docs-language-change';

/**
 * Get the stored language preference from localStorage
 */
function getStoredLanguage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
  } catch {
    return null;
  }
}

/**
 * Store language preference and broadcast to other components
 */
function setStoredLanguage(label: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, label);
    // Dispatch custom event for other components on the same page
    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: label }));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Dynamic loading of code examples using webpack's require.context.
 * Example files use .txt extension to avoid TypeScript compilation.
 * 
 * To add a new example:
 * Simply create the file in examples/ with original extension + .txt
 * (e.g., examples/guides/actions/define-basic.ts.txt)
 * 
 * No code changes needed - files are auto-discovered at build time.
 */

// Use webpack's require.context to auto-discover all .txt files in examples/
const exampleContext = require.context('@/examples', true, /\.txt$/);

// Build the CODE_EXAMPLES map automatically from discovered files
const CODE_EXAMPLES: Record<string, string> = {};
exampleContext.keys().forEach((key) => {
  // Transform './react/provider-basic.tsx.txt' -> 'react/provider-basic.tsx'
  const normalizedKey = key.replace(/^\.\//, '').replace(/\.txt$/, '');
  const content = exampleContext<{ default?: string } | string>(key);
  CODE_EXAMPLES[normalizedKey] = typeof content === 'string' ? content : (content.default || '');
});

/**
 * Detect language from file extension
 */
function getLanguageFromPath(src: string): string {
  const ext = src.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    tsx: 'tsx',
    ts: 'typescript',
    jsx: 'jsx',
    js: 'javascript',
    json: 'json',
    css: 'css',
    html: 'html',
    py: 'python',
    sh: 'bash',
    bash: 'bash',
    vue: 'vue',
    svelte: 'svelte',
  };
  return langMap[ext] || 'text';
}

/**
 * Get a human-friendly label from a file path or language
 */
function getLabelFromPath(src: string): string {
  const ext = src.split('.').pop()?.toLowerCase() || '';
  const labelMap: Record<string, string> = {
    tsx: 'React (TypeScript)',
    ts: 'TypeScript',
    jsx: 'React',
    js: 'JavaScript',
    json: 'JSON',
    css: 'CSS',
    html: 'HTML',
    py: 'Python',
    sh: 'Bash',
    bash: 'Bash',
    vue: 'Vue',
    svelte: 'Svelte',
  };
  return labelMap[ext] || ext.toUpperCase();
}

interface CodeSnippetProps {
  /** Path relative to examples/ directory (without .txt suffix) */
  src: string;
  /** Override the display title (defaults to src path) */
  title?: string;
  /** Override language detection */
  language?: string;
  className?: string;
}

/**
 * Import and display a code snippet from the examples directory.
 * Shows file path in the header like Hatchet's docs.
 * 
 * Usage in MDX:
 * <CodeSnippet src="react/provider-basic.tsx" />
 */
export function CodeSnippet({
  src,
  title,
  language,
  className,
}: CodeSnippetProps) {
  const code = CODE_EXAMPLES[src];
  
  if (!code) {
    console.warn(`CodeSnippet: No example found for "${src}"`);
    return (
      <div className="bg-red-900/20 text-red-400 p-4 rounded-lg my-3 text-sm">
        Example not found: <code>{src}</code>
      </div>
    );
  }

  const displayPath = title || `examples/${src}`;
  const detectedLanguage = language || getLanguageFromPath(src);

  return (
    <SyntaxHighlightedPre
      code={code.trim()}
      language={detectedLanguage}
      filePath={displayPath}
      className={className}
    />
  );
}

/**
 * A single snippet configuration for CodeSnippetTabs
 */
export interface SnippetTab {
  /** Path relative to examples/ directory (without .txt suffix) */
  src: string;
  /** Tab label (defaults to language name from extension) */
  label?: string;
  /** Override language detection */
  language?: string;
}

interface CodeSnippetTabsProps {
  /** Array of snippets to display as tabs */
  snippets: SnippetTab[];
  /** Override the display title (shown in code block header) */
  title?: string;
  /** Default active tab index (defaults to 0) */
  defaultTab?: number;
  className?: string;
}

/**
 * Display multiple code snippets with language tabs.
 * Language preference is synced across all CodeSnippetTabs and persisted in localStorage.
 * 
 * Usage in MDX:
 * <CodeSnippetTabs
 *   snippets={[
 *     { src: "guides/actions/example.ts", label: "TypeScript" },
 *     { src: "guides/actions/example.js", label: "JavaScript" },
 *   ]}
 * />
 */
export function CodeSnippetTabs({
  snippets,
  title,
  defaultTab = 0,
  className,
}: CodeSnippetTabsProps) {
  // Validate snippets first to get labels
  const validSnippets = (snippets || []).map((snippet) => {
    const code = CODE_EXAMPLES[snippet.src];
    const label = snippet.label || getLabelFromPath(snippet.src);
    const language = snippet.language || getLanguageFromPath(snippet.src);
    return { ...snippet, code, label, language };
  });

  // Always start with defaultTab for SSR, then sync with localStorage after hydration
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Sync with stored preference after hydration (avoids SSR mismatch)
  useEffect(() => {
    const storedLabel = getStoredLanguage();
    if (storedLabel) {
      const matchingIndex = validSnippets.findIndex((s) => s.label === storedLabel);
      if (matchingIndex !== -1 && matchingIndex !== activeTab) {
        setActiveTab(matchingIndex);
      }
    }
  }, []); // Run once on mount

  // Sync with other components when language changes
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent<string>) => {
      const newLabel = event.detail;
      const matchingIndex = validSnippets.findIndex((s) => s.label === newLabel);
      if (matchingIndex !== -1 && matchingIndex !== activeTab) {
        setActiveTab(matchingIndex);
      }
    };

    // Listen for changes from other components
    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange as EventListener);

    // Also listen for storage changes from other tabs/windows
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LANGUAGE_PREFERENCE_KEY && event.newValue) {
        const matchingIndex = validSnippets.findIndex((s) => s.label === event.newValue);
        if (matchingIndex !== -1 && matchingIndex !== activeTab) {
          setActiveTab(matchingIndex);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [validSnippets, activeTab]);

  // Handle tab click - update local state and broadcast
  const handleTabClick = useCallback((index: number, label: string) => {
    setActiveTab(index);
    setStoredLanguage(label);
  }, []);

  if (!snippets || snippets.length === 0) {
    return (
      <div className="bg-red-900/20 text-red-400 p-4 rounded-lg my-3 text-sm">
        CodeSnippetTabs: No snippets provided
      </div>
    );
  }

  const missingSnippets = validSnippets.filter((s) => !s.code);
  if (missingSnippets.length > 0) {
    return (
      <div className="bg-red-900/20 text-red-400 p-4 rounded-lg my-3 text-sm">
        CodeSnippetTabs: Examples not found:{' '}
        {missingSnippets.map((s) => (
          <code key={s.src} className="mx-1">
            {s.src}
          </code>
        ))}
      </div>
    );
  }

  const activeSnippet = validSnippets[activeTab];
  const displayPath = title || `examples/${activeSnippet.src}`;

  return (
    <div className={cn('relative group rounded-lg overflow-hidden my-3', className)}>
      {/* Tabs header */}
      <div className="flex items-center bg-zinc-800 border-b border-zinc-700">
        {validSnippets.map((snippet, index) => (
          <button
            key={snippet.src}
            onClick={() => handleTabClick(index, snippet.label)}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-colors',
              'border-b-2 -mb-px',
              activeTab === index
                ? 'text-zinc-100 border-blue-500 bg-zinc-800/50'
                : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-700/30'
            )}
          >
            {snippet.label}
          </button>
        ))}
      </div>

      {/* Active code snippet */}
      <SyntaxHighlightedPre
        code={activeSnippet.code!.trim()}
        language={activeSnippet.language}
        filePath={displayPath}
        className="!my-0 !rounded-none"
      />
    </div>
  );
}
