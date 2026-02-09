import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Separate config for standalone bundle with React included
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear dist, we're building in addition to main build
    lib: {
      entry: path.resolve(__dirname, 'src/SourcesCard.tsx'),
      formats: ['es'],
      fileName: () => 'sources-card.bundle.js'
    },
    rollupOptions: {
      // Bundle everything - no externals
      external: [],
      output: {
        // Inline all imports into a single file
        inlineDynamicImports: true,
      }
    }
  }
})

