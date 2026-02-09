/**
 * TypeScript declaration for Intercom messenger
 */
declare global {
  interface Window {
    Intercom?: (command: string, ...args: unknown[]) => void;
  }
}

export {};
