"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { useDocsPreferences, type Framework } from "./DocsPreferencesProvider";
import { useDocsPreferencesDialog } from "./DocsLayoutClient";
import { cn } from "@/lib/utils";

const FRAMEWORK_SHORT: Record<Framework, string> = {
  React: "React",
  Vue: "Vue",
  Angular: "Angular",
  "Vanilla JS": "JS",
};

export function DocsToolbar() {
  const [copied, setCopied] = useState(false);
  const { framework } = useDocsPreferences();
  const openPreferences = useDocsPreferencesDialog();

  const getPageMarkdown = useCallback(() => {
    const article = document.querySelector("article.prose");
    if (!article) return "";
    const h1 = article.querySelector("h1");
    const title =
      h1?.textContent || document.title.replace(" | Pillar Docs", "");
    const content =
      (article as HTMLElement).innerText || article.textContent || "";
    return `# ${title}\n\n${content}`;
  }, []);

  const handleCopyForLLM = async () => {
    const text = getPageMarkdown();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewAsMD = () => {
    const text = getPageMarkdown();
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="flex items-center justify-between gap-2 mb-5 text-[13px] text-muted-foreground">
      <div className="flex items-center gap-1 flex-wrap">
        <ToolbarButton
          icon={
            copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )
          }
          onClick={handleCopyForLLM}
        >
          {copied ? "Copied!" : "Copy for LLM"}
        </ToolbarButton>
        <ToolbarButton
          icon={
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path d="M2 3h12v1.5H2zm0 4h8v1.5H2zm0 4h10v1.5H2z" />
            </svg>
          }
          onClick={handleViewAsMD}
        >
          View as MD
        </ToolbarButton>
      </div>

      <button
        onClick={openPreferences}
        className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0"
      >
        {FRAMEWORK_SHORT[framework]}
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-3 w-3 opacity-50"
        >
          <path d="M4 6l4 4 4-4z" />
        </svg>
      </button>
    </div>
  );
}

function ToolbarButton({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md",
        "text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}
