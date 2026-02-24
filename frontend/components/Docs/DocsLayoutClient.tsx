"use client";

import { createContext, useContext, useState } from "react";
import { DocsHeader } from "./DocsHeader";
import { DocsSearchCommand } from "./DocsSearchCommand";

const DocsSearchContext = createContext<() => void>(() => {});

export function useDocsSearch() {
  return useContext(DocsSearchContext);
}

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
    <DocsSearchContext.Provider value={() => setSearchOpen(true)}>
      {/* Command palette modal */}
      <DocsSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Desktop header with logo and search */}
      <div className="hidden lg:block sticky top-0 w-full z-1">
        <DocsHeader onOpenSearch={() => setSearchOpen(true)} />
      </div>

      {children}
    </DocsSearchContext.Provider>
  );
}
