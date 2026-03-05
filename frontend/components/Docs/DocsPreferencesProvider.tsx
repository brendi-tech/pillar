"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Framework = "React" | "Vue" | "Angular" | "Vanilla JS";
export type PackageManager = "npm" | "pnpm" | "yarn";

const VALID_FRAMEWORKS: Framework[] = ["React", "Vue", "Angular", "Vanilla JS"];

const FRAMEWORK_ALIASES: Record<string, Framework> = {
  react: "React",
  vue: "Vue",
  angular: "Angular",
  vanilla: "Vanilla JS",
  "vanilla-js": "Vanilla JS",
  vanillajs: "Vanilla JS",
  js: "Vanilla JS",
  javascript: "Vanilla JS",
};

export interface DocsPreferences {
  framework: Framework;
  packageManager: PackageManager;
}

interface DocsPreferencesContextValue extends DocsPreferences {
  setFramework: (framework: Framework) => void;
  setPackageManager: (packageManager: PackageManager) => void;
  setPreferences: (prefs: Partial<DocsPreferences>) => void;
}

const STORAGE_KEY = "pillar-docs-preferences";
const CHANGE_EVENT = "pillar-docs-preferences-change";

const DEFAULTS: DocsPreferences = {
  framework: "React",
  packageManager: "npm",
};

function readPreferences(): DocsPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      framework: parsed.framework ?? DEFAULTS.framework,
      packageManager: parsed.packageManager ?? DEFAULTS.packageManager,
    };
  } catch {
    return DEFAULTS;
  }
}

function writePreferences(prefs: DocsPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(
      new CustomEvent(CHANGE_EVENT, { detail: prefs })
    );
  } catch {
    // ignore storage errors
  }
}

const DocsPreferencesContext = createContext<DocsPreferencesContextValue>({
  ...DEFAULTS,
  setFramework: () => {},
  setPackageManager: () => {},
  setPreferences: () => {},
});

export function useDocsPreferences() {
  return useContext(DocsPreferencesContext);
}

export function DocsPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<DocsPreferences>(DEFAULTS);

  // Hydrate from query param (?framework=react) or localStorage after mount
  useEffect(() => {
    const stored = readPreferences();
    const params = new URLSearchParams(window.location.search);
    const frameworkParam = params.get("framework");

    if (frameworkParam) {
      const key = frameworkParam.toLowerCase();
      const match =
        VALID_FRAMEWORKS.find((f) => f.toLowerCase() === key) ??
        FRAMEWORK_ALIASES[key];

      if (match) {
        const next = { ...stored, framework: match };
        setPrefs(next);
        writePreferences(next);

        // Clean the query param from the URL without a navigation
        params.delete("framework");
        const qs = params.toString();
        const clean = window.location.pathname + (qs ? `?${qs}` : "");
        window.history.replaceState(null, "", clean);
        return;
      }
    }

    setPrefs(stored);
  }, []);

  // Sync across components on the same page and across tabs
  useEffect(() => {
    const handleCustomEvent = (e: CustomEvent<DocsPreferences>) => {
      setPrefs(e.detail);
    };
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setPrefs({
            framework: parsed.framework ?? DEFAULTS.framework,
            packageManager: parsed.packageManager ?? DEFAULTS.packageManager,
          });
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener(CHANGE_EVENT, handleCustomEvent as EventListener);
    window.addEventListener("storage", handleStorageEvent);
    return () => {
      window.removeEventListener(
        CHANGE_EVENT,
        handleCustomEvent as EventListener
      );
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const setPreferences = useCallback(
    (updates: Partial<DocsPreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...updates };
        writePreferences(next);
        return next;
      });
    },
    []
  );

  const setFramework = useCallback(
    (framework: Framework) => setPreferences({ framework }),
    [setPreferences]
  );

  const setPackageManager = useCallback(
    (packageManager: PackageManager) => setPreferences({ packageManager }),
    [setPreferences]
  );

  return (
    <DocsPreferencesContext.Provider
      value={{ ...prefs, setFramework, setPackageManager, setPreferences }}
    >
      {children}
    </DocsPreferencesContext.Provider>
  );
}
