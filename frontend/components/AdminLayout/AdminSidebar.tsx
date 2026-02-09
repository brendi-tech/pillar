"use client";

import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { useAuth, useProduct } from "@/providers";
import { usePillar } from "@pillar-ai/react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  CreditCard,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Sliders,
  Sun,
  Users,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
    title: "Actions",
    href: "/actions",
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
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    currentProduct,
    availableProducts,
    switchProduct,
    isLoading: isLoadingProducts,
  } = useProduct();
  const { open: openPillarPanel } = usePillar();
  const [footerPopoverOpen, setFooterPopoverOpen] = useState(false);

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

  // Get user initials for avatar fallback
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

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
          <Popover open={footerPopoverOpen} onOpenChange={setFooterPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-accent">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-xs font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate text-sm font-medium leading-tight">
                      {user.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground leading-tight">
                      {isLoadingProducts
                        ? "Loading..."
                        : currentProduct?.name || "Select Assistant"}
                    </span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-64 p-1"
              align="start"
              side="top"
              sideOffset={4}
            >
              {/* User Info Header */}
              <div className="px-2 py-2 border-b border-sidebar-border mb-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>

              {/* Assistant Switcher Section */}
              {availableProducts.length > 0 && (
                <>
                  <div className="px-2 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Assistant
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {availableProducts.map((hc) => (
                      <button
                        key={hc.id}
                        onClick={() => {
                          switchProduct(hc.id);
                          setFooterPopoverOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          currentProduct?.id === hc.id
                            ? "bg-sidebar-accent text-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                        )}
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-xs font-bold shrink-0">
                          {hc.name.charAt(0)}
                        </div>
                        <span className="flex-1 truncate text-left">
                          {hc.name}
                        </span>
                        {currentProduct?.id === hc.id && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  {/* New Assistant Link */}
                  <Link
                    href="/onboarding?new=true"
                    onClick={() => setFooterPopoverOpen(false)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-muted-foreground/50">
                      <Plus className="h-3 w-3" />
                    </div>
                    <span>New Assistant</span>
                  </Link>
                  <div className="border-t border-sidebar-border my-1" />
                </>
              )}

              {/* Actions Section */}
              <div className="space-y-0.5">
                {/* Theme Toggle */}
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                </button>

                {/* Sign Out */}
                <button
                  onClick={() => {
                    setFooterPopoverOpen(false);
                    router.push("/logout");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
