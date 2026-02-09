import type { AdminUser } from "@/types/admin";
import { type StateCreator } from "zustand";

// Note: Hooks are exported separately from ./hooks to avoid circular dependencies
// Import hooks directly from "@/store/global/userSlice/hooks"

export interface UserSlice {
  user: {
    data: AdminUser | null;
    setUser: (user: AdminUser | null) => void;
    clearUser: () => void;
  };
}

export const createUserSlice: StateCreator<
  UserSlice,
  [["zustand/devtools", never]],
  [],
  UserSlice
> = (set) => ({
  user: {
    data: null,
    setUser: (user: AdminUser | null) => {
      set((state) => ({
        user: {
          ...state.user,
          data: user,
        },
      }));
    },
    clearUser: () => {
      set((state) => ({
        user: {
          ...state.user,
          data: null,
        },
      }));
    },
  },
});

