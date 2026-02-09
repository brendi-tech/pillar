/**
 * Global store for the Theme Selector Modal.
 * 
 * Uses a simple event-based pattern to allow opening the modal
 * from anywhere in the app (including non-React contexts like task handlers).
 */

import { useEffect, useState } from 'react';

// Simple event emitter for modal state
type ModalListener = (isOpen: boolean) => void;
const listeners = new Set<ModalListener>();
let currentState = false;

function emit(isOpen: boolean) {
  currentState = isOpen;
  listeners.forEach((listener) => listener(isOpen));
}

/**
 * Open the theme selector modal from anywhere.
 * Can be called from outside React components.
 */
export function openThemeSelectorModal() {
  emit(true);
}

/**
 * Close the theme selector modal from anywhere.
 */
export function closeThemeSelectorModal() {
  emit(false);
}

/**
 * Hook to subscribe to and control the theme selector modal.
 * Use in the modal component itself.
 */
export function useThemeSelectorModal() {
  const [isOpen, setIsOpen] = useState(currentState);

  useEffect(() => {
    const listener: ModalListener = (open) => setIsOpen(open);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    isOpen,
    open: () => emit(true),
    close: () => emit(false),
  };
}
