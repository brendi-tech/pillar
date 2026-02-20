/**
 * Global store for the Invite Members Modal.
 *
 * Uses the same event-based pattern as ApiKeysModal / ThemeSelectorModal
 * to allow opening from anywhere (including non-React tool handlers).
 */

import { useEffect, useState } from "react";

export interface InviteMembersModalData {
  emails?: string[];
  role?: "admin" | "member";
}

type ModalListener = (isOpen: boolean, data: InviteMembersModalData | null) => void;
const listeners = new Set<ModalListener>();
let currentOpen = false;
let currentData: InviteMembersModalData | null = null;

function emit(isOpen: boolean, data: InviteMembersModalData | null) {
  currentOpen = isOpen;
  currentData = isOpen ? data : null;
  listeners.forEach((listener) => listener(currentOpen, currentData));
}

/**
 * Open the invite members modal from anywhere.
 * Pass data to pre-fill emails and/or role.
 */
export function openInviteMembersModal(data?: InviteMembersModalData) {
  emit(true, data ?? null);
}

export function closeInviteMembersModal() {
  emit(false, null);
}

/**
 * Hook to subscribe to the invite members modal state.
 */
export function useInviteMembersModal() {
  const [isOpen, setIsOpen] = useState(currentOpen);
  const [data, setData] = useState<InviteMembersModalData | null>(currentData);

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
    open: (d?: InviteMembersModalData) => emit(true, d ?? null),
    close: () => emit(false, null),
  };
}
