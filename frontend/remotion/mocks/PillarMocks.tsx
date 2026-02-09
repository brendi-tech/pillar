/**
 * Mock Pillar SDK hooks for Remotion rendering.
 * These allow components that use the Pillar SDK to render in isolation.
 */

import React, { createContext, useContext } from "react";

interface MockPillarContext {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
}

const PillarContext = createContext<MockPillarContext>({
  open: () => {},
  close: () => {},
  toggle: () => {},
  isOpen: false,
});

/**
 * Mock usePillar hook - returns no-op functions
 */
export function usePillar(): MockPillarContext {
  return useContext(PillarContext);
}

/**
 * Provider to wrap components that need Pillar SDK mocking
 */
export function MockPillarProvider({
  children,
  isOpen = false,
}: {
  children: React.ReactNode;
  isOpen?: boolean;
}) {
  const value: MockPillarContext = {
    open: () => {},
    close: () => {},
    toggle: () => {},
    isOpen,
  };

  return (
    <PillarContext.Provider value={value}>{children}</PillarContext.Provider>
  );
}
