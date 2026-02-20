/**
 * Global store for the API Keys Modal.
 *
 * Uses the same event-based pattern as ThemeSelectorModal to allow
 * opening from anywhere (including non-React tool handlers).
 */

import { useEffect, useState } from "react";

export interface ApiKeysModalData {
  auto_generate?: boolean;
  name?: string;
}

type ModalListener = (isOpen: boolean, data: ApiKeysModalData | null) => void;
const listeners = new Set<ModalListener>();
let currentOpen = false;
let currentData: ApiKeysModalData | null = null;

function emit(isOpen: boolean, data: ApiKeysModalData | null) {
  currentOpen = isOpen;
  currentData = isOpen ? data : null;
  listeners.forEach((listener) => listener(currentOpen, currentData));
}

/**
 * Open the API keys modal from anywhere.
 * Pass data to pre-fill or auto-generate a key.
 */
export function openApiKeysModal(data?: ApiKeysModalData) {
  emit(true, data ?? null);
}

export function closeApiKeysModal() {
  emit(false, null);
}

/**
 * Hook to subscribe to the API keys modal state.
 */
export function useApiKeysModal() {
  const [isOpen, setIsOpen] = useState(currentOpen);
  const [data, setData] = useState<ApiKeysModalData | null>(currentData);

  useEffect(() => {
    const listener: ModalListener = (open, d) => {
      setIsOpen(open);
      setData(d);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    isOpen,
    data,
    open: (d?: ApiKeysModalData) => emit(true, d ?? null),
    close: () => emit(false, null),
  };
}
