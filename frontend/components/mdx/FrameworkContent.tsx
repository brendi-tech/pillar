"use client";

import { useDocsPreferences, type Framework } from "@/components/Docs/DocsPreferencesProvider";

interface FrameworkContentProps {
  framework: Framework | Framework[];
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on the global docs framework preference.
 * Accepts a single framework or an array.
 *
 * Usage in MDX:
 *   <FrameworkContent framework="React">Only shown when React is selected</FrameworkContent>
 *   <FrameworkContent framework={["Vue", "Angular"]}>Shown for Vue or Angular</FrameworkContent>
 */
export function FrameworkContent({ framework, children }: FrameworkContentProps) {
  const { framework: selected } = useDocsPreferences();
  const allowed = Array.isArray(framework) ? framework : [framework];

  if (!allowed.includes(selected)) return null;

  return <>{children}</>;
}
