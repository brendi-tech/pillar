import type { Action } from "@/types/actions";

export type ToolSourceGroup = "client_side" | "server_side";

export const TOOL_SOURCE_LABELS: Record<ToolSourceGroup, string> = {
  client_side: "Client Tools",
  server_side: "Server Tools",
};

/**
 * Parse tool ID from the pathname.
 * Expected patterns:
 * - /tools → no selection
 * - /tools/[toolId] → tool selected
 * - /tools/deployments → deployments page
 * - /tools/new → new tool wizard
 */
export function parseToolIdFromPathname(pathname: string): string | null {
  const parts = pathname.replace(/\/$/, "").split("/");
  const toolsIndex = parts.indexOf("tools");

  if (toolsIndex === -1) {
    return null;
  }

  const toolId = parts[toolsIndex + 1] || null;

  const nonToolRoutes = ["new", "deployments", "mcp", "openapi", "client", "server"];
  if (toolId && nonToolRoutes.includes(toolId)) {
    return null;
  }

  return toolId;
}

/**
 * Parse MCP source ID from the pathname.
 * Expected pattern: /tools/mcp/[sourceId]
 */
export function parseMcpSourceIdFromPathname(pathname: string): string | null {
  const parts = pathname.replace(/\/$/, "").split("/");
  const toolsIndex = parts.indexOf("tools");

  if (toolsIndex === -1) return null;
  if (parts[toolsIndex + 1] !== "mcp") return null;

  return parts[toolsIndex + 2] || null;
}

/**
 * Parse OpenAPI source ID from the pathname.
 * Expected pattern: /tools/openapi/[sourceId]
 */
export function parseOpenAPISourceIdFromPathname(pathname: string): string | null {
  const parts = pathname.replace(/\/$/, "").split("/");
  const toolsIndex = parts.indexOf("tools");

  if (toolsIndex === -1) return null;
  if (parts[toolsIndex + 1] !== "openapi") return null;

  return parts[toolsIndex + 2] || null;
}

export type McpItemType = "tool" | "resource" | "prompt";

/**
 * Parse the active MCP item from URL search params.
 * Looks for ?tool=, ?resource=, or ?prompt= query params.
 */
export function parseMcpItemFromSearchParams(
  searchParams: URLSearchParams
): { type: McpItemType; name: string } | null {
  const tool = searchParams.get("tool");
  if (tool) return { type: "tool", name: tool };

  const resource = searchParams.get("resource");
  if (resource) return { type: "resource", name: resource };

  const prompt = searchParams.get("prompt");
  if (prompt) return { type: "prompt", name: prompt };

  return null;
}

const TOOL_GROUP_ROUTES: Record<string, ToolSourceGroup> = {
  client: "client_side",
  server: "server_side",
};

/**
 * Parse tool group from pathname.
 * Returns "client_side" for /tools/client, "server_side" for /tools/server.
 */
export function parseToolGroupFromPathname(
  pathname: string
): ToolSourceGroup | null {
  const parts = pathname.replace(/\/$/, "").split("/");
  const toolsIndex = parts.indexOf("tools");
  if (toolsIndex === -1) return null;
  const segment = parts[toolsIndex + 1];
  if (!segment) return null;
  return TOOL_GROUP_ROUTES[segment] ?? null;
}

/**
 * Group tools by their execution source (client_side vs server_side).
 */
export function groupToolsBySource(
  tools: Action[]
): Record<ToolSourceGroup, Action[]> {
  const groups: Record<ToolSourceGroup, Action[]> = {
    client_side: [],
    server_side: [],
  };

  for (const tool of tools) {
    const key =
      tool.tool_type === "client_side" ? "client_side" : "server_side";
    groups[key].push(tool);
  }

  return groups;
}
