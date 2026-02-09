import type { ComponentType } from 'react';

export interface CategoryItem {
  id: string;
  name: string;
  icon: ComponentType<{ className?: string }>;
  count: number;
}

export interface FooterAction {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export interface CategoryNavSidebarProps {
  /** List of categories to display */
  categories: CategoryItem[];
  /** Currently active category ID, or null for "All" */
  activeCategory: string | null;
  /** Callback when a category is selected */
  onCategorySelect: (id: string | null) => void;
  /** Label for the "All" button (default: "All") */
  allLabel?: string;
  /** Total count to show on "All" button */
  allCount?: number;
  /** Optional footer action (e.g., "Add Source") */
  footerAction?: FooterAction;
  /** Additional className for the container */
  className?: string;
}




