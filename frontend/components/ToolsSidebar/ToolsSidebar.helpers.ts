import type { Action, ActionType } from "@/types/actions";
import {
  ArrowRight,
  Copy,
  Database,
  ExternalLink,
  Layout,
  LayoutPanelLeft,
  Pencil,
  PlayCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon mapping for action types
 */
export const TOOL_TYPE_ICONS: Record<ActionType, LucideIcon> = {
  navigate: ArrowRight,
  open_modal: Layout,
  fill_form: Pencil,
  trigger_tool: Zap,
  trigger_action: Zap, // @deprecated alias
  query: Database,
  copy_text: Copy,
  external_link: ExternalLink,
  start_tutorial: PlayCircle,
  inline_ui: LayoutPanelLeft,
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

  const nonToolRoutes = ["new", "deployments"];
  if (toolId && nonToolRoutes.includes(toolId)) {
    return null;
  }

  return toolId;
}

/**
 * Group tools by their action_type.
 * Order matches backend alphabetical sort for proper infinite scroll UX.
 */
export function groupToolsByType(tools: Action[]): Record<ActionType, Action[]> {
  const groups: Record<ActionType, Action[]> = {
    copy_text: [],
    external_link: [],
    fill_form: [],
    inline_ui: [],
    navigate: [],
    open_modal: [],
    query: [],
    start_tutorial: [],
    trigger_action: [], // @deprecated alias
    trigger_tool: [],
  };

  for (const tool of tools) {
    if (groups[tool.action_type]) {
      groups[tool.action_type].push(tool);
    }
  }

  return groups;
}
