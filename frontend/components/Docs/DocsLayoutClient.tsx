"use client";

import { createContext, useContext, useState } from "react";
import { DocsHeader } from "./DocsHeader";
import { DocsPreferencesDialog } from "./DocsPreferencesDialog";
import { DocsSearchCommand } from "./DocsSearchCommand";

interface DocsLayoutContextValue {
  openSearch: () => void;
  openPreferences: () => void;
}

const DocsLayoutContext = createContext<DocsLayoutContextValue>({
  openSearch: () => {},
  openPreferences: () => {},
});

export function useDocsSearch() {
  return useContext(DocsLayoutContext).openSearch;
}

export function useDocsPreferencesDialog() {
  return useContext(DocsLayoutContext).openPreferences;
}

interface DocsLayoutClientProps {
  children: React.ReactNode;
}

/**
 * Client wrapper for docs layout that handles search and preferences dialog state.
 */
export function DocsLayoutClient({ children }: DocsLayoutClientProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  return (
    <DocsLayoutContext.Provider
      value={{
        openSearch: () => setSearchOpen(true),
        openPreferences: () => setPreferencesOpen(true),
      }}
    >
      <DocsSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <DocsPreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
      />

      {/* Desktop header with logo and search */}
      <div className="hidden lg:block sticky top-0 w-full z-30">
        <DocsHeader
          onOpenSearch={() => setSearchOpen(true)}
          onOpenPreferences={() => setPreferencesOpen(true)}
        />
      </div>

      {children}
    </DocsLayoutContext.Provider>
  );
}
