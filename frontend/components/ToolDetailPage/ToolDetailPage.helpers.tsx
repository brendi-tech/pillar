import type { Action, ImplementationStatus } from "@/types/actions";
import type { MetadataItem } from "@/components/shared";
import type { ImplementationStatusDisplay } from "./ToolDetailPage.types";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Layout,
  LayoutPanelLeft,
  Pencil,
  PlayCircle,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon components mapped by icon name string
 */
export const TOOL_ICON_COMPONENTS: Record<string, LucideIcon> = {
  "arrow-right": ArrowRight,
  layout: Layout,
  "edit-3": Pencil,
  zap: Zap,
  database: Database,
  copy: Copy,
  "external-link": ExternalLink,
  "play-circle": PlayCircle,
  "layout-panel-left": LayoutPanelLeft,
};

/**
 * Get display properties for implementation status
 */
export function getImplementationStatusDisplay(
  status: ImplementationStatus
): ImplementationStatusDisplay {
  switch (status) {
    case "verified":
      return {
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        description: "Handler implemented and confirmed working.",
      };
    case "failing":
      return {
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        icon: <XCircle className="h-3.5 w-3.5" />,
        description: "Last execution reported a failure.",
      };
    case "stale":
      return {
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        icon: <Clock className="h-3.5 w-3.5" />,
        description: "No confirmations in the last 30 days.",
      };
    default:
      return {
        className:
          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        icon: <CircleHelp className="h-3.5 w-3.5" />,
        description: "No execution confirmations received yet.",
      };
  }
}

/**
 * Build metadata items for the detail page strip
 */
export function buildMetadataItems(action: Action): MetadataItem[] {
  const items: MetadataItem[] = [];

  if (action.action_type === "navigate" && action.path_template) {
    items.push({
      label: "Path",
      value: (
        <code className="truncate rounded bg-muted px-2 py-0.5 text-xs">
          {action.path_template}
        </code>
      ),
      colSpan: 2,
    });
  }

  if (action.action_type === "external_link" && action.external_url) {
    items.push({
      label: "URL",
      value: (
        <code className="truncate rounded bg-muted px-2 py-0.5 text-xs">
          {action.external_url}
        </code>
      ),
      colSpan: 2,
    });
  }

  return items;
}
