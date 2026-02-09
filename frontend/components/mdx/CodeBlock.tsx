'use client';

import { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language = 'text',
  filename,
  showLineNumbers = false,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clean up the code - remove trailing newlines
  const cleanCode = code.trim();

  return (
    <div className={cn('relative group rounded-lg overflow-hidden my-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-800 dark:bg-zinc-900 px-4 py-2">
        <div className="flex items-center gap-2 text-zinc-400 text-xs">
          <Terminal className="h-3.5 w-3.5" />
          <span>{filename || language}</span>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded',
            copied 
              ? 'text-green-400' 
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
          )}
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <Highlight
        theme={themes.oneDark}
        code={cleanCode}
        language={language as any}
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
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="table-row">
                {showLineNumbers && (
                  <span className="table-cell text-right pr-4 select-none text-zinc-500 text-xs w-8">
                    {i + 1}
                  </span>
                )}
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

// Inline code component
interface InlineCodeProps {
  children: React.ReactNode;
  className?: string;
}

export function InlineCode({ children, className }: InlineCodeProps) {
  return (
    <code
      className={cn(
        'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm',
        className
      )}
    >
      {children}
    </code>
  );
}


