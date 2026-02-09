'use client';

import { useMemo } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { cn } from '@/lib/utils';

interface CodeWithIndentGuidesProps {
  code: string;
  language?: string;
  className?: string;
  /** Number of spaces per indent level (default: 4) */
  tabSize?: number;
}

/**
 * Renders code with syntax highlighting and visual indent guides
 * Similar to how VS Code/PyCharm displays indentation
 */
export function CodeWithIndentGuides({
  code,
  language = 'tsx',
  className,
  tabSize = 4,
}: CodeWithIndentGuidesProps) {
  const cleanCode = code.trim();

  // Calculate indent level for each line
  const getIndentLevel = (lineText: string) => {
    const match = lineText.match(/^(\s*)/);
    const leadingSpaces = match ? match[1].length : 0;
    return Math.floor(leadingSpaces / tabSize);
  };

  return (
    <Highlight
      theme={themes.oneDark}
      code={cleanCode}
      language={language as any}
    >
      {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            highlightClassName,
            'overflow-x-auto p-4 rounded-lg',
            'text-[13px] leading-relaxed font-mono',
            className
          )}
          style={{ ...style, margin: 0 }}
        >
          {tokens.map((line, lineIndex) => {
            // Get the raw text for this line to calculate indent
            const lineText = line.map(token => token.content).join('');
            const indentLevel = getIndentLevel(lineText);
            const lineProps = getLineProps({ line });

            return (
              <div key={lineIndex} {...lineProps} className="relative">
                {/* Indent guides */}
                {indentLevel > 0 && (
                  <span className="absolute left-0 top-0 bottom-0 pointer-events-none" aria-hidden="true">
                    {Array.from({ length: indentLevel }).map((_, i) => (
                      <span
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-zinc-600/50"
                        style={{ left: `${i * tabSize}ch` }}
                      />
                    ))}
                  </span>
                )}
                {/* Highlighted tokens */}
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}
