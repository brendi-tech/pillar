import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, PluginOption } from "vite";

// Separate config for standalone ChatGPT bundle
// Uses SourcesCardOpenAi which includes business logic and auto-mounting
export default defineConfig({
  plugins: [react() as PluginOption],
  build: {
    outDir: "dist",
    emptyOutDir: false, // Don't clean dist - previous builds already there
    lib: {
      entry: path.resolve(__dirname, "src/sources-card/index.tsx"),
      formats: ["es"],
      fileName: "sources-card.bundle",
    },
    rollupOptions: {
      // Include everything (no externals) for standalone bundle
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
