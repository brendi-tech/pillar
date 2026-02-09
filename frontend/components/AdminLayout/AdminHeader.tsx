"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Minimal admin header that only shows mobile sidebar trigger.
 * On desktop, the sidebar is always visible so this header is hidden.
 */
export function AdminHeader() {
  return (
    <header className="flex h-10 items-center px-4 md:hidden">
      <SidebarTrigger />
    </header>
  );
}
