'use client';

import { useCallback } from 'react';
import { useDocsPreferences, type Framework } from '@/components/Docs/DocsPreferencesProvider';
import { useDocsUser, replaceSlugPlaceholders } from '@/components/Docs/DocsUserProvider';
import { SyntaxHighlightedPre } from './SyntaxHighlightedPre';
import { cn } from '@/lib/utils';

const FRAMEWORK_VALUES: Framework[] = ['React', 'Vue', 'Angular', 'Vanilla JS'];

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
  const rawCode = CODE_EXAMPLES[src];
  const { slug } = useDocsUser();
  
  if (!rawCode) {
    console.warn(`CodeSnippet: No example found for "${src}"`);
    return (
      <div className="bg-red-900/20 text-red-400 p-4 rounded-lg my-3 text-sm">
        Example not found: <code>{src}</code>
      </div>
    );
  }

  const code = replaceSlugPlaceholders(rawCode.trim(), slug);
  const displayPath = title || `examples/${src}`;
  const detectedLanguage = language || getLanguageFromPath(src);

  return (
    <SyntaxHighlightedPre
      code={code}
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
 * Framework preference is synced via DocsPreferencesContext.
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
  const { framework, setFramework } = useDocsPreferences();
  const { slug } = useDocsUser();

  const validSnippets = (snippets || []).map((snippet) => {
    const rawCode = CODE_EXAMPLES[snippet.src];
    const code = rawCode ? replaceSlugPlaceholders(rawCode, slug) : rawCode;
    const label = snippet.label || getLabelFromPath(snippet.src);
    const language = snippet.language || getLanguageFromPath(snippet.src);
    return { ...snippet, code, label, language };
  });

  // Derive active tab from global framework preference
  const preferredIndex = validSnippets.findIndex((s) => s.label === framework);
  const activeTab = preferredIndex !== -1 ? preferredIndex : defaultTab;

  const handleTabClick = useCallback(
    (index: number, label: string) => {
      if (FRAMEWORK_VALUES.includes(label as Framework)) {
        setFramework(label as Framework);
      }
    },
    [setFramework]
  );

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

      {/* All snippets stacked via CSS Grid - prevents layout shift on tab switch */}
      <div className="grid">
        {validSnippets.map((snippet, index) => (
          <div
            key={snippet.src}
            className={cn(
              '[grid-area:1/1]',
              activeTab !== index && 'invisible'
            )}
            aria-hidden={activeTab !== index}
          >
            <SyntaxHighlightedPre
              code={snippet.code!.trim()}
              language={snippet.language}
              filePath={title || `examples/${snippet.src}`}
              className="!my-0 !rounded-none h-full"
              fillHeight
            />
          </div>
        ))}
      </div>
    </div>
  );
}
