"use client";

import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { UserFooterPopover } from "@/components/UserFooterPopover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparatorWithLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, useProduct } from "@/providers";
import type { AdminProduct } from "@/types/admin";
import { usePillar } from "@pillar-ai/react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CreditCard,
  MessageSquare,
  Search,
  Sliders,
  Users,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EditProductModal } from "./EditProductModal";

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  category: "overview" | "data" | "insights" | "settings";
  disabled?: boolean;
  badge?: string;
  count?: number;
}

// ============================================================================
// Navigation Configuration
// ============================================================================

const navigationItems: NavItem[] = [
  {
    title: "Knowledge",
    href: "/knowledge",
    icon: BookOpen,
    category: "data",
  },
  {
    title: "Tools",
    href: "/tools",
    icon: Zap,
    category: "data",
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    category: "insights",
  },
  {
    title: "Conversations",
    href: "/analytics/conversations",
    icon: MessageSquare,
    category: "insights",
  },
  {
    title: "Configure",
    href: "/configure",
    icon: Sliders,
    category: "settings",
  },
  {
    title: "Billing",
    href: "/billing",
    icon: CreditCard,
    category: "settings",
  },
  {
    title: "Team",
    href: "/team",
    icon: Users,
    category: "settings",
  },
];

// ============================================================================
// Component
// ============================================================================

export function AdminSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    currentProduct,
    availableProducts,
    switchProduct,
    isLoading: isLoadingProducts,
    refetchProducts,
  } = useProduct();
  const { open: openPillarPanel } = usePillar();
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(
    null
  );

  // Handle ⌘K keyboard shortcut to open Pillar panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openPillarPanel({ focusInput: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openPillarPanel]);

  // Normalize pathname for comparison
  const normalizedPathname =
    pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  // Close sidebar on mobile when navigating
  const closeMobileSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

  // Group navigation items by category
  const groupedItems = useMemo(() => {
    return {
      overview: navigationItems.filter((item) => item.category === "overview"),
      data: navigationItems.filter((item) => item.category === "data"),
      insights: navigationItems.filter((item) => item.category === "insights"),
      settings: navigationItems.filter((item) => item.category === "settings"),
    };
  }, []);

  // Check if a path is active
  const isActive = useCallback(
    (href: string, hash?: string): boolean => {
      const currentHash =
        typeof window !== "undefined"
          ? window.location.hash.replace("#", "")
          : "";

      if (href === "/") {
        return normalizedPathname === "/";
      }

      // For hash-based sub-items
      if (hash) {
        return normalizedPathname === href && currentHash === hash;
      }

      // For "All" items (no hash), active when on the page with no hash
      if (normalizedPathname === href && !hash && !currentHash) {
        return true;
      }

      // Exact match
      if (normalizedPathname === href) {
        return true;
      }

      // Check for nested routes
      if (normalizedPathname.startsWith(href + "/")) {
        const allHrefs = navigationItems.map((i) => i.href);
        const hasMoreSpecificMatch = allHrefs.some(
          (otherHref) =>
            otherHref !== href &&
            normalizedPathname.startsWith(otherHref) &&
            otherHref.startsWith(href)
        );
        return !hasMoreSpecificMatch;
      }

      return false;
    },
    [normalizedPathname]
  );

  // Render a regular navigation item
  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    if (item.disabled) {
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton disabled className="opacity-50 cursor-not-allowed">
            <Icon />
            <span>{item.title}</span>
            {item.badge && (
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={active}>
          <Link href={item.href} onClick={closeMobileSidebar}>
            <Icon />
            <span>{item.title}</span>
            {item.count !== undefined && item.count > 0 && (
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {item.count}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar {...props}>
      {/* Header with Logo and Search */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex justify-start">
          <PillarLogoWithName className="h-8 w-auto" />
        </div>

        {/* Search Button - Opens Pillar Help Panel */}
        <button
          onClick={() => openPillarPanel({ focusInput: true })}
          className="mt-3 flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {/* Knowledge Section (Primary) */}
            <SidebarSeparatorWithLabel label="KNOWLEDGE" />
            <SidebarMenu>{groupedItems.data.map(renderNavItem)}</SidebarMenu>

            {/* Insights Section */}
            <SidebarSeparatorWithLabel label="INSIGHTS" />
            <SidebarMenu>
              {groupedItems.insights.map(renderNavItem)}
            </SidebarMenu>

            {/* Settings Section */}
            <SidebarSeparatorWithLabel label="SETTINGS" />
            <SidebarMenu>
              {groupedItems.settings.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with Combined User & Assistant Dropdown */}
      <SidebarFooter className="border-t border-sidebar-border">
        {user && (
          <UserFooterPopover
            user={user}
            currentProduct={currentProduct}
            availableProducts={availableProducts}
            isLoadingProducts={isLoadingProducts}
            switchProduct={switchProduct}
            setEditingProduct={setEditingProduct}
            theme={theme}
            setTheme={setTheme}
          />
        )}
      </SidebarFooter>

      {/* Edit Assistant Modal */}
      <EditProductModal
        open={editingProduct !== null}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null);
        }}
        product={editingProduct}
        onSuccess={refetchProducts}
      />
    </Sidebar>
  );
}
