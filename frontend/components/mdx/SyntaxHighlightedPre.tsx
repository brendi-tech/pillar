'use client';

import { useState, useCallback, ReactNode } from 'react';
import { Check, Copy, Sparkles, Terminal } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Mermaid } from './Mermaid';

interface SyntaxHighlightedPreProps {
  /** Code wrapped in MDX code element (standard MDX usage) */
  children?: ReactNode;
  className?: string;
  /** Optional file path to display in header instead of language */
  filePath?: string;
  /** Direct code string (alternative to children, used by CodeSnippet) */
  code?: string;
  /** Language for syntax highlighting (used with code prop) */
  language?: string;
}

// Languages that should NOT get copy buttons (diagrams, plain text, etc.)
const PLAIN_TEXT_LANGUAGES = new Set([
  'text',
  'plaintext',
  'plain',
  'ascii',
  'diagram',
  '', // No language specified
]);

// Languages that support syntax highlighting in prism
const CODE_LANGUAGES = new Set([
  'tsx',
  'typescript',
  'ts',
  'javascript',
  'js',
  'jsx',
  'json',
  'bash',
  'sh',
  'shell',
  'css',
  'html',
  'python',
  'py',
  'sql',
  'yaml',
  'yml',
  'markdown',
  'md',
  'graphql',
  'vue',
  'svelte',
  'markup',
]);

// Map framework-specific languages to Prism-supported equivalents
const LANGUAGE_ALIASES: Record<string, string> = {
  vue: 'markup',
  svelte: 'markup',
};

/**
 * Extract code text and language from MDX pre/code children.
 * MDX wraps code in: <pre><code className="language-tsx">...</code></pre>
 */
function extractCodeInfo(children: ReactNode): { code: string; language: string } {
  let code = '';
  let language = '';

  // Recursively extract text content
  const extractText = (node: ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node && typeof node === 'object' && 'props' in node) {
      const element = node as { props?: { children?: ReactNode; className?: string } };
      
      // Check for language class on code element
      if (element.props?.className) {
        const match = element.props.className.match(/language-(\w+)/);
        if (match) {
          language = match[1];
        }
      }
      
      if (element.props?.children) {
        return extractText(element.props.children);
      }
    }
    return '';
  };

  code = extractText(children);
  return { code: code.trim(), language };
}

/**
 * A unified code block component for MDX that handles:
 * - Syntax highlighting for code (tsx, js, bash, etc.)
 * - Plain rendering for diagrams and ASCII art
 * - Copy/Prompt buttons for code only
 */
export function SyntaxHighlightedPre({
  children,
  className,
  filePath,
  code: codeProp,
  language: languageProp,
}: SyntaxHighlightedPreProps) {
  const [copied, setCopied] = useState<'code' | 'prompt' | null>(null);
  const pathname = usePathname();

  // Use direct props if provided, otherwise extract from children
  const extracted = children ? extractCodeInfo(children) : { code: '', language: '' };
  const code = codeProp ?? extracted.code;
  const language = languageProp ?? extracted.language;
  
  // Determine if this is actual code or just text/diagram
  const isPlainText = PLAIN_TEXT_LANGUAGES.has(language) || !language;
  const isCode = CODE_LANGUAGES.has(language);
  const isMermaid = language === 'mermaid';

  // Define hooks unconditionally (React rules of hooks)
  const handleCopyCode = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied('code');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [code]);

  const handleCopyAsPrompt = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const pageUrl = `https://pillar.so${pathname}`;
    const prompt = `Help me integrate this Pillar SDK code into my project:

\`\`\`${language}
${code}
\`\`\`

Source: ${pageUrl}

Adapt this to fit my existing codebase—match my file structure, naming conventions, and import patterns. If anything is unclear, refer to the documentation link above for additional context.`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied('prompt');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  }, [code, language, pathname]);

  // Handle mermaid diagrams specially (after hooks)
  if (isMermaid) {
    return <Mermaid chart={code} className={className} />;
  }

  // For plain text / diagrams - simple rendering without buttons
  if (isPlainText) {
    return (
      <pre
        className={cn(
          'bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto my-3',
          'text-sm leading-relaxed font-mono',
          className
        )}
      >
        <code>{code}</code>
      </pre>
    );
  }

  // For code - syntax highlighting with copy buttons
  return (
    <div className={cn('relative group rounded-lg overflow-hidden my-3', className)}>
      {/* Header with language and copy buttons */}
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2 text-zinc-400 text-xs">
          <Terminal className="h-3.5 w-3.5" />
          <span>{filePath || language || 'code'}</span>
        </div>
        
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Copy as prompt button */}
          <button
            onClick={handleCopyAsPrompt}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-md',
              'text-xs font-medium transition-all duration-200',
              copied === 'prompt'
                ? 'bg-green-500/90 text-white'
                : 'bg-zinc-700/90 text-zinc-200 hover:bg-zinc-600'
            )}
            aria-label="Copy as AI prompt"
          >
            {copied === 'prompt' ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Prompt</span>
              </>
            )}
          </button>

          {/* Copy code button */}
          <button
            onClick={handleCopyCode}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-md',
              'text-xs font-medium transition-all duration-200',
              copied === 'code'
                ? 'bg-green-500/90 text-white'
                : 'bg-zinc-700/90 text-zinc-200 hover:bg-zinc-600'
            )}
            aria-label="Copy code"
          >
            {copied === 'code' ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Syntax highlighted code */}
      <Highlight
        theme={themes.oneDark}
        code={code}
        language={isCode ? (LANGUAGE_ALIASES[language] || language) as any : 'text'}
      >
        {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(
              highlightClassName,
              'overflow-x-auto p-4 text-sm leading-relaxed',
              'scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent'
            )}
            style={{ ...style, margin: 0, borderRadius: 0 }}
          >
            {tokens.map((line, lineIndex) => (
              <div key={lineIndex} {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
