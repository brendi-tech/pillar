/**
 * React hooks for OpenAI Apps SDK integration
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  OpenAiGlobals,
  SET_GLOBALS_EVENT_TYPE,
  SetGlobalsEvent,
  UnknownObject,
} from "./types";

/**
 * Hook to subscribe to a single OpenAI global value
 * Based on: https://developers.openai.com/apps-sdk/build/custom-ux#useopenaio-global
 */
export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K
): OpenAiGlobals[K] | undefined {
  return useSyncExternalStore(
    (onChange) => {
      const handleSetGlobal = (event: Event) => {
        const customEvent = event as SetGlobalsEvent;
        const value = customEvent.detail.globals[key];
        if (value === undefined) {
          return;
        }
        onChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
        passive: true,
      });

      return () => {
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
      };
    },
    () => window.openai?.[key]
  );
}

/**
 * Hook to get tool output data
 */
export function useToolOutput<T = UnknownObject>(): T | null {
  const output = useOpenAiGlobal("toolOutput");
  return (output as T) ?? null;
}

/**
 * Hook to get tool input data
 */
export function useToolInput<T = UnknownObject>(): T | undefined {
  return useOpenAiGlobal("toolInput") as T | undefined;
}

/**
 * Hook to get theme (light/dark mode)
 */
export function useTheme(): "light" | "dark" {
  return useOpenAiGlobal("theme") ?? "light";
}

/**
 * Hook to get display mode
 */
export function useDisplayMode() {
  return useOpenAiGlobal("displayMode") ?? "inline";
}

/**
 * Hook to manage widget state with persistence
 * Based on: https://developers.openai.com/apps-sdk/build/custom-ux#persist-component-state-expose-context-to-chatgpt
 */
export function useWidgetState<T extends UnknownObject>(
  defaultState: T | (() => T)
): readonly [T, (state: React.SetStateAction<T>) => void];
export function useWidgetState<T extends UnknownObject>(
  defaultState?: T | (() => T | null) | null
): readonly [T | null, (state: React.SetStateAction<T | null>) => void];
export function useWidgetState<T extends UnknownObject>(
  defaultState?: T | (() => T | null) | null
): readonly [T | null, (state: React.SetStateAction<T | null>) => void] {
  const widgetStateFromWindow = useOpenAiGlobal("widgetState") as T | null;

  const [widgetState, _setWidgetState] = useState<T | null>(() => {
    if (widgetStateFromWindow != null) {
      return widgetStateFromWindow;
    }

    return typeof defaultState === "function"
      ? (defaultState as () => T | null)()
      : defaultState ?? null;
  });

  useEffect(() => {
    if (widgetStateFromWindow !== undefined) {
      _setWidgetState(widgetStateFromWindow ?? null);
    }
  }, [widgetStateFromWindow]);

  const setWidgetState = useCallback(
    (state: React.SetStateAction<T | null>) => {
      _setWidgetState((prevState) => {
        const newState = typeof state === "function" ? state(prevState) : state;

        if (newState != null && window.openai?.setWidgetState) {
          window.openai.setWidgetState(newState);
        }

        return newState;
      });
    },
    []
  );

  return [widgetState, setWidgetState] as const;
}
