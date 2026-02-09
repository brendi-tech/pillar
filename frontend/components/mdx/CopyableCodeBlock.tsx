"use client";

import { useState, useCallback, ReactNode } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface CopyableCodeBlockProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a code block with click-to-copy functionality.
 * Shows copy buttons in the top-right corner on hover.
 * - "Copy" copies just the code
 * - "Prompt" copies the code wrapped in an AI prompt with page context
 */
export function CopyableCodeBlock({
  children,
  className,
}: CopyableCodeBlockProps) {
  const [copied, setCopied] = useState<"code" | "prompt" | null>(null);
  const pathname = usePathname();

  // Extract text from React children
  const extractText = useCallback((node: ReactNode): string => {
    if (typeof node === "string") {
      return node;
    }
    if (typeof node === "number") {
      return String(node);
    }
    if (Array.isArray(node)) {
      return node.map(extractText).join("");
    }
    if (node && typeof node === "object" && "props" in node) {
      const element = node as { props?: { children?: ReactNode } };
      if (element.props?.children) {
        return extractText(element.props.children);
      }
    }
    return "";
  }, []);

  const getCodeText = useCallback(() => {
    return extractText(children);
  }, [children, extractText]);

  const handleCopyCode = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(getCodeText());
        setCopied("code");
        setTimeout(() => setCopied(null), 2000);
      } catch (err) {
        console.error("Failed to copy code:", err);
      }
    },
    [getCodeText]
  );

  const handleCopyAsPrompt = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      const code = getCodeText();
      const pageUrl = `https://pillar.so${pathname}`;

      const prompt = `Help me integrate this Pillar SDK code into my project:

\`\`\`
${code.trim()}
\`\`\`

Source: ${pageUrl}

Adapt this to fit my existing codebase—match my file structure, naming conventions, and import patterns. If anything is unclear, refer to the documentation link above for additional context.`;

      try {
        await navigator.clipboard.writeText(prompt);
        setCopied("prompt");
        setTimeout(() => setCopied(null), 2000);
      } catch (err) {
        console.error("Failed to copy prompt:", err);
      }
    },
    [getCodeText, pathname]
  );

  return (
    <div
      className={cn("relative group", "transition-all duration-150", className)}
    >
      {/* Button container - visible on hover */}
      <div
        className={cn(
          "absolute top-3 right-3 z-10",
          "flex items-center gap-1.5",
          "opacity-0 group-hover:opacity-100",
          "transition-all duration-200"
        )}
      >
        {/* Copy as prompt button */}
        <button
          onClick={handleCopyAsPrompt}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-md",
            "text-xs font-medium",
            "transition-all duration-200",
            copied === "prompt"
              ? "bg-green-500/90 text-white"
              : "bg-gray-700/90 text-gray-200 hover:bg-gray-600"
          )}
          aria-label="Copy as AI prompt"
        >
          {copied === "prompt" ? (
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
            "flex items-center gap-1.5 px-2 py-1.5 rounded-md",
            "text-xs font-medium",
            "transition-all duration-200",
            copied === "code"
              ? "bg-green-500/90 text-white"
              : "bg-gray-700/90 text-gray-200 hover:bg-gray-600"
          )}
          aria-label="Copy code"
        >
          {copied === "code" ? (
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

      {/* Hover overlay */}
      <div
        className={cn(
          "absolute inset-0 rounded-lg pointer-events-none",
          "transition-all duration-150",
          "opacity-0 group-hover:opacity-100",
          "ring-1 ring-inset ring-white/0 group-hover:ring-white/20"
        )}
      />

      {/* The actual code block */}
      {children}
    </div>
  );
}
