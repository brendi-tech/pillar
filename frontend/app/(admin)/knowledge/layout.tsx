"use client";

import { SourcesSidebar } from "@/components/Sources/SourcesPage/SourcesSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PanelLeftIcon } from "lucide-react";
import { useState } from "react";

interface KnowledgeLayoutProps {
  children: React.ReactNode;
}

export default function KnowledgeLayout({ children }: KnowledgeLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Desktop sidebar - visible on large containers */}
      <div className="hidden @[800px]/content:flex">
        <SourcesSidebar />
      </div>

      {/* Mobile sidebar (Sheet) - visible on small containers */}
      <div className="@[800px]/content:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="w-80 p-0 pt-8"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <SheetTitle className="sr-only">
              Knowledge Sources Navigation
            </SheetTitle>
            <SourcesSidebar
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
              <h1 className="text-lg font-semibold">Knowledge</h1>
              <p className="text-xs text-muted-foreground">
                Manage your knowledge sources
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sources list"
            >
              <PanelLeftIcon className="mr-1.5 h-4 w-4" />
              Sources
            </Button>
          </div>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-hidden bg-muted/30">{children}</div>
      </div>
    </div>
  );
}
