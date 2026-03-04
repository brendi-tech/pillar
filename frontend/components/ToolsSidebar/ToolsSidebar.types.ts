import type { Action } from "@/types/actions";

export interface ToolsSidebarProps {
  /** Callback when navigation occurs (used to close mobile sidebar) */
  onNavigate?: () => void;
  hideHeader?: boolean;
}

export interface ToolListItemProps {
  action: Action;
  isSelected: boolean;
  onNavigate?: () => void;
}

export interface EmptyStateProps {
  searchTerm: string;
  hasAnyTools: boolean;
}
