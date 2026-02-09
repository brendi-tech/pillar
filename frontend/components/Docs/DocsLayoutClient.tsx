"use client";

import { useState } from "react";
import { DocsHeader } from "./DocsHeader";
import { DocsSearchCommand } from "./DocsSearchCommand";

interface DocsLayoutClientProps {
  children: React.ReactNode;
}

/**
 * Client wrapper for docs layout that handles search state.
 * The header and command palette need client-side state management.
 */
export function DocsLayoutClient({ children }: DocsLayoutClientProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      {/* Command palette modal */}
      <DocsSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Desktop header with logo, search, Ask AI */}
      <div className="hidden lg:block sticky top-0 w-full z-1">
        <DocsHeader onOpenSearch={() => setSearchOpen(true)} />
      </div>

      {children}
    </>
  );
}
