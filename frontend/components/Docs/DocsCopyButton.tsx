"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Copy, ChevronDown, ExternalLink, Terminal } from "lucide-react";
import { useCallback, useState } from "react";

export function DocsCopyButton() {
  const [copied, setCopied] = useState(false);

  const getPageContent = useCallback(() => {
    // Extract text content from the article element on the page
    const article = document.querySelector("article.prose-hc");
    if (!article) return "";
    // Get the page title from the first h1, or from the document title
    const h1 = article.querySelector("h1");
    const title = h1?.textContent || document.title.replace(" | Pillar Docs", "");
    const content = (article as HTMLElement).innerText || article.textContent || "";
    return `# ${title}\n\n${content}`;
  }, []);

  const handleCopyPage = async () => {
    const text = getPageContent();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenChatGPT = () => {
    const pageUrl = encodeURIComponent(window.location.href);
    const chatUrl = `https://chatgpt.com/?hints=search&q=Read+this+page+and+answer+my+questions:+${pageUrl}`;
    window.open(chatUrl, "_blank");
  };

  const handleOpenClaude = () => {
    const pageUrl = encodeURIComponent(window.location.href);
    const claudeUrl = `https://claude.ai/new?q=Read+this+page+and+answer+my+questions:+${pageUrl}`;
    window.open(claudeUrl, "_blank");
  };

  const handleConnectCursor = () => {
    const config = {
      url: "https://api.tri-pillar.com/mcp/pillar-docs/sse",
    };
    const configBase64 = btoa(JSON.stringify(config));
    const encodedName = encodeURIComponent("pillar-docs");
    window.location.href = `cursor://anysphere.cursor-mcp/install?name=${encodedName}&config=${configBase64}`;
  };

  const handleConnectVSCode = () => {
    const config = {
      url: "https://api.tri-pillar.com/mcp/pillar-docs/sse",
    };
    const configBase64 = btoa(JSON.stringify(config));
    const encodedName = encodeURIComponent("pillar-docs");
    window.location.href = `vscode://anthropic.claude-mcp/install?name=${encodedName}&config=${configBase64}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy page
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={handleCopyPage}>
          <Copy className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">Copy page</span>
            <span className="text-xs text-muted-foreground">
              Copy page as Markdown for LLMs
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleOpenChatGPT}>
          <ExternalLink className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">Open in ChatGPT</span>
            <span className="text-xs text-muted-foreground">
              Ask questions about this page
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpenClaude}>
          <ExternalLink className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">Open in Claude</span>
            <span className="text-xs text-muted-foreground">
              Ask questions about this page
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleConnectCursor}>
          <Terminal className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">Connect to Cursor</span>
            <span className="text-xs text-muted-foreground">
              Install MCP Server on Cursor
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleConnectVSCode}>
          <Terminal className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">Connect to VS Code</span>
            <span className="text-xs text-muted-foreground">
              Install MCP Server on VS Code
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
