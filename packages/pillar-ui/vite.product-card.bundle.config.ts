import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// Separate config for product card bundle
// Uses ProductCardOpenAi which includes business logic and auto-mounting
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: false, // Don't clean dist - sources-card bundle already there
    lib: {
      entry: path.resolve(__dirname, "src/product-card/index.tsx"),
      formats: ["es"],
      fileName: "product-card.bundle",
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
