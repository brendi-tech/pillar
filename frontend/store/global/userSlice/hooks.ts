import { useGlobalStore } from "@/store/global";

/**
 * Hook to get the current user from the global store.
 */
export const useUser = () => useGlobalStore((state) => state.user.data);

/**
 * Hook to get the setUser function from the global store.
 */
export const useSetUser = () => useGlobalStore((state) => state.user.setUser);

/**
 * Hook to get the clearUser function from the global store.
 */
export const useClearUser = () =>
  useGlobalStore((state) => state.user.clearUser);

