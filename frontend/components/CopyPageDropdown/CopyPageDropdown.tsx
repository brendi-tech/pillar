"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

interface CopyPageDropdownProps {
  /** Current page URL path (e.g., "/getting-started/quick-start") */
  pageUrl: string;
  /** Corresponding llms.txt URL path (e.g., "/getting-started/quick-start/llms.txt") */
  llmsTxtUrl: string;
  /** MCP server URL for IDE integrations */
  mcpServerUrl?: string;
  /** Help center name for display in IDE config */
  helpCenterName: string;
  /** Optional className for styling */
  className?: string;
}

export function CopyPageDropdown({
  pageUrl,
  llmsTxtUrl,
  mcpServerUrl,
  helpCenterName,
  className,
}: CopyPageDropdownProps) {
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get base URL for constructing full URLs
  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "";
  };

  // Get full llms.txt URL (via Next.js API proxy)
  const getFullLlmsTxtUrl = () => {
    // Use Next.js API route to proxy the request
    return `/api/llms-txt?path=${encodeURIComponent(llmsTxtUrl)}`;
  };

  // Get MCP server URL (defaults to /mcp on current domain)
  const getMcpUrl = () => {
    if (mcpServerUrl) {
      return mcpServerUrl;
    }
    return `${getBaseUrl()}/mcp`;
  };

  const handleCopyPage = async () => {
    setIsLoading(true);
    try {
      const apiUrl = getFullLlmsTxtUrl();
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error("Failed to fetch llms.txt");
      }

      const markdown = await response.text();
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy page:", error);
      // Fallback: try to copy current page URL
      await navigator.clipboard.writeText(getBaseUrl() + pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChatGPT = () => {
    // Use the full public URL for llms.txt
    const fullLlmsUrl = `${getBaseUrl()}${llmsTxtUrl}`;
    const llmsUrl = encodeURIComponent(fullLlmsUrl);
    const chatUrl = `https://chatgpt.com/?hints=search&q=Read+this+page+and+answer+my+questions:+${llmsUrl}`;
    window.open(chatUrl, "_blank");
  };

  const handleOpenClaude = () => {
    // Use the full public URL for llms.txt
    const fullLlmsUrl = `${getBaseUrl()}${llmsTxtUrl}`;
    const llmsUrl = encodeURIComponent(fullLlmsUrl);
    const claudeUrl = `https://claude.ai/new?q=Read+this+page+and+answer+my+questions:+${llmsUrl}`;
    window.open(claudeUrl, "_blank");
  };

  const handleConnectCursor = () => {
    const mcpUrl = getMcpUrl();
    const config = {
      url: mcpUrl,
    };
    const configBase64 = btoa(JSON.stringify(config));
    const encodedName = encodeURIComponent(helpCenterName);
    const cursorUrl = `cursor://anysphere.cursor-mcp/install?name=${encodedName}&config=${configBase64}`;
    window.location.href = cursorUrl;
  };

  const handleConnectVSCode = () => {
    const mcpUrl = getMcpUrl();
    const config = {
      url: mcpUrl,
    };
    const configBase64 = btoa(JSON.stringify(config));
    const encodedName = encodeURIComponent(helpCenterName);
    const vscodeUrl = `vscode://anthropic.claude-mcp/install?name=${encodedName}&config=${configBase64}`;
    window.location.href = vscodeUrl;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          disabled={isLoading}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              <span className="hidden sm:inline">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Copy page</span>
            </>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={handleCopyPage} disabled={isLoading}>
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
          <div className="h-4 w-4 mr-2 flex items-center justify-center">
            <span className="text-xs">🤖</span>
          </div>
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-1">
              <span className="font-medium">Open in ChatGPT</span>
              <ExternalLink className="h-3 w-3 opacity-50" />
            </div>
            <span className="text-xs text-muted-foreground">
              Ask questions about this page
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleOpenClaude}>
          <div className="h-4 w-4 mr-2 flex items-center justify-center">
            <span className="text-xs">✨</span>
          </div>
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-1">
              <span className="font-medium">Open in Claude</span>
              <ExternalLink className="h-3 w-3 opacity-50" />
            </div>
            <span className="text-xs text-muted-foreground">
              Ask questions about this page
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleConnectCursor}>
          <div className="h-4 w-4 mr-2 flex items-center justify-center">
            <span className="text-xs">⌨️</span>
          </div>
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-1">
              <span className="font-medium">Connect to Cursor</span>
              <ExternalLink className="h-3 w-3 opacity-50" />
            </div>
            <span className="text-xs text-muted-foreground">
              Install MCP Server on Cursor
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleConnectVSCode}>
          <div className="h-4 w-4 mr-2 flex items-center justify-center">
            <span className="text-xs">📝</span>
          </div>
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-1">
              <span className="font-medium">Connect to VS Code</span>
              <ExternalLink className="h-3 w-3 opacity-50" />
            </div>
            <span className="text-xs text-muted-foreground">
              Install MCP Server on VS Code
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
