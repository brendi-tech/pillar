"use client";

import {
  useDocsPreferences,
  type PackageManager,
} from "@/components/Docs/DocsPreferencesProvider";
import { cn } from "@/lib/utils";
import { SyntaxHighlightedPre } from "./SyntaxHighlightedPre";

const PACKAGE_MANAGERS: PackageManager[] = ["npm", "pnpm", "yarn"];

function getInstallCommand(pm: PackageManager, pkg: string): string {
  switch (pm) {
    case "npm":
      return `npm install ${pkg}`;
    case "pnpm":
      return `pnpm add ${pkg}`;
    case "yarn":
      return `yarn add ${pkg}`;
  }
}

interface PackageInstallProps {
  /** Package name(s) to install, e.g. "@pillar-ai/react" */
  package: string;
  className?: string;
}

export function PackageInstall({ package: pkg, className }: PackageInstallProps) {
  const { packageManager, setPackageManager } = useDocsPreferences();
  const command = getInstallCommand(packageManager, pkg);

  return (
    <div className={cn("relative group rounded-lg overflow-hidden my-3", className)}>
      <div className="flex items-center bg-zinc-800 border-b border-zinc-700">
        {PACKAGE_MANAGERS.map((pm) => (
          <button
            key={pm}
            onClick={() => setPackageManager(pm)}
            className={cn(
              "px-4 py-2 text-xs font-medium transition-colors",
              "border-b-2 -mb-px",
              packageManager === pm
                ? "text-zinc-100 border-blue-500 bg-zinc-800/50"
                : "text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-700/30"
            )}
          >
            {pm}
          </button>
        ))}
      </div>
      <SyntaxHighlightedPre
        code={command}
        language="bash"
        className="!my-0 !rounded-none"
      />
    </div>
  );
}
