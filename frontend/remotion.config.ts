import { Config } from "@remotion/cli/config";
import path from "path";
import type { WebpackOverrideFn } from "@remotion/bundler";

// Use process.cwd() to get the correct root directory
const rootDir = process.cwd();

// Set output format for still images
Config.setStillImageFormat("png");

// Overwrite existing files when rendering
Config.setOverwriteOutput(true);

// Override webpack to alias Next.js/SDK imports
// Note: We use pre-compiled Tailwind CSS instead of @remotion/tailwind
// because @remotion/tailwind uses Tailwind v3 but this project uses v4.
// Pre-compile with: npx @tailwindcss/cli -i app/globals.css -o remotion/compiled-styles.css
const webpackOverride: WebpackOverrideFn = (config) => {
  const aliases: Record<string, string> = {
    // Resolve @ alias for project imports
    "@": rootDir,
    // Alias Next.js imports to our mocks
    "next/link": path.join(rootDir, "remotion/mocks/NextMocks.tsx"),
    "next/navigation": path.join(rootDir, "remotion/mocks/NextMocks.tsx"),
    // Alias Pillar SDK imports to our mocks
    "@pillar-ai/react": path.join(rootDir, "remotion/mocks/PillarMocks.tsx"),
  };

  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...(config.resolve?.alias as Record<string, string>),
        ...aliases,
      },
    },
  };
};

Config.overrideWebpackConfig(webpackOverride);
