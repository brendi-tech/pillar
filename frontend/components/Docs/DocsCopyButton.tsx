"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, ChevronDown, Terminal } from "lucide-react";
import { useState } from "react";

interface DocsCopyButtonProps {
  content: string; // Markdown content of the page
  title: string;
}

export function DocsCopyButton({ content, title }: DocsCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPage = async () => {
    await navigator.clipboard.writeText(`# ${title}\n\n${content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectCursor = () => {
    // Cursor MCP install protocol: cursor://anysphere.cursor-deeplink/mcp/install?...
    const mcpConfig = {
      name: "pillar-docs",
      command: "npx",
      args: [
        "-y",
        "@anthropic-ai/mcp-remote@latest",
        "https://api.tri-pillar.com/mcp/pillar-docs/sse",
      ],
    };
    const url = `cursor://anysphere.cursor-deeplink/mcp/install?name=${mcpConfig.name}&config=${encodeURIComponent(JSON.stringify(mcpConfig))}`;
    window.open(url, "_blank");
  };

  const handleConnectVSCode = () => {
    // VS Code MCP install (similar pattern)
    const mcpConfig = {
      name: "pillar-docs",
      command: "npx",
      args: [
        "-y",
        "@anthropic-ai/mcp-remote@latest",
        "https://api.tri-pillar.com/mcp/pillar-docs/sse",
      ],
    };
    const url = `vscode://anthropic.claude-mcp/install?config=${encodeURIComponent(JSON.stringify(mcpConfig))}`;
    window.open(url, "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Copy className="h-4 w-4" />
          {copied ? "Copied!" : "Copy page"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleCopyPage}>
          <Copy className="h-4 w-4 mr-2" />
          <div>
            <div className="font-medium">Copy page</div>
            <div className="text-xs text-muted-foreground">
              Copy page as Markdown for LLMs
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleConnectCursor}>
          <Terminal className="h-4 w-4 mr-2" />
          <div>
            <div className="font-medium">Connect to Cursor</div>
            <div className="text-xs text-muted-foreground">
              Install MCP Server on Cursor
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleConnectVSCode}>
          <Terminal className="h-4 w-4 mr-2" />
          <div>
            <div className="font-medium">Connect to VS Code</div>
            <div className="text-xs text-muted-foreground">
              Install MCP Server on VS Code
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
