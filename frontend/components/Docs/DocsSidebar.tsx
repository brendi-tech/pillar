"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import type { NavSection, NavGroup } from "@/lib/docs-navigation";
import { cn } from "@/lib/utils";
import { ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface DocsSidebarProps {
  navigation: NavSection[];
}

function NavLink({
  href,
  title,
  isActive,
  onItemClick,
}: {
  href: string;
  title: string;
  isActive: boolean;
  onItemClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onItemClick}
        className={cn(
          "block py-1.5 pl-4 text-sm transition-colors",
          isActive
            ? "text-primary font-medium -ml-px border-l-2 border-primary pl-[15px]"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {title}
      </Link>
    </li>
  );
}

function NavGroupSection({
  group,
  pathname,
  onItemClick,
}: {
  group: NavGroup;
  pathname: string;
  onItemClick?: () => void;
}) {
  const hasActiveItem = group.items.some((item) => pathname === item.href);

  return (
    <Collapsible defaultOpen={hasActiveItem}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 py-1 pl-4 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group">
        <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90 shrink-0" />
        <span>{group.title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              title={item.title}
              isActive={pathname === item.href}
              onItemClick={onItemClick}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavItems({
  navigation,
  onItemClick,
}: {
  navigation: NavSection[];
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {navigation.map((section) => {
        const hasGroups = section.groups && section.groups.length > 0;

        return (
          <Collapsible key={section.slug} defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors group">
              <span>{section.title}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              {/* Standard flat items */}
              {section.items.length > 0 && (
                <ul className="mt-2 space-y-1 border-l border-border">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      title={item.title}
                      isActive={pathname === item.href}
                      onItemClick={onItemClick}
                    />
                  ))}
                </ul>
              )}

              {/* Grouped items (used by Reference section) */}
              {hasGroups && (
                <div className="mt-2 space-y-2 border-l border-border">
                  {section.groups!.map((group) => (
                    <NavGroupSection
                      key={group.title}
                      group={group}
                      pathname={pathname}
                      onItemClick={onItemClick}
                    />
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
}

/**
 * Mobile header with navigation sheet - renders full-bleed on mobile
 */
export function DocsMobileHeader({ navigation }: DocsSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden sticky top-0 z-40 bg-background border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/docs" className="flex items-center">
          <PillarLogoWithName className="h-6" />
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle>
                <PillarLogoWithName className="h-6" />
              </SheetTitle>
            </SheetHeader>
            <div className="p-4 overflow-y-auto h-[calc(100vh-65px)]">
              <NavItems
                navigation={navigation}
                onItemClick={() => setOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

/**
 * Desktop sidebar - only visible on lg+ screens
 * Logo and search are now in the header (DocsHeader)
 */
export function DocsDesktopSidebar({ navigation }: DocsSidebarProps) {
  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-20 pr-4 max-h-[calc(100vh-5rem)] overflow-y-auto">
        <NavItems navigation={navigation} />
      </div>
    </aside>
  );
}

/**
 * @deprecated Use DocsMobileHeader and DocsDesktopSidebar separately for proper layout control
 */
export function DocsSidebar({ navigation }: DocsSidebarProps) {
  return (
    <>
      <DocsMobileHeader navigation={navigation} />
      <DocsDesktopSidebar navigation={navigation} />
    </>
  );
}
