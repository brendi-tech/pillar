import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createUserSlice, type UserSlice } from "./userSlice";

export type Store = UserSlice;

export const useGlobalStore = create<Store>()(
  devtools((...a) => ({
    user: createUserSlice(...a).user,
  }))
);

