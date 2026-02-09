"use client";

import { ActionsSidebar } from "@/components/Actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PanelLeftIcon } from "lucide-react";
import { useState } from "react";

interface ActionsLayoutProps {
  children: React.ReactNode;
}

export default function ActionsLayout({ children }: ActionsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Desktop sidebar - visible on large containers */}
      <div className="hidden @[800px]/content:flex">
        <ActionsSidebar />
      </div>

      {/* Mobile sidebar (Sheet) - visible on small containers */}
      <div className="@[800px]/content:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-80 p-0 pt-8">
            <SheetTitle className="sr-only">Actions Navigation</SheetTitle>
            <ActionsSidebar
              onNavigate={() => setSidebarOpen(false)}
              hideHeader
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header with sidebar toggle - visible on small containers */}
        <div className="shrink-0 border-b px-4 py-3 @[800px]/content:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Actions</h1>
              <p className="text-xs text-muted-foreground">
                View synced actions
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open actions list"
            >
              <PanelLeftIcon className="mr-1.5 h-4 w-4" />
              Actions
            </Button>
          </div>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-hidden bg-muted/30">{children}</div>
      </div>
    </div>
  );
}
