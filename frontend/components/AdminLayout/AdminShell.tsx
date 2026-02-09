"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SystemBanner } from "@/components/SystemBanner";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";

interface AdminShellProps {
  children: React.ReactNode;
}

/**
 * Main admin shell component.
 * Provides the sidebar navigation and header with user menu.
 * Uses the SidebarProvider for consistent sidebar behavior.
 */
export function AdminShell({ children }: AdminShellProps) {
  return (
    <SidebarProvider>
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main content area */}
      <SidebarInset className="h-svh bg-sidebar">
        <div className="bg-background flex flex-col h-full border overflow-hidden md:border-border md:rounded-2xl md:m-2 md:ml-0 @container/content">
          {/* System notifications banner */}
          <SystemBanner />

          {/* Header - mobile only */}
          <AdminHeader />

          {/* Page content with staggered animation */}
          <main className="admin-animate-in flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
