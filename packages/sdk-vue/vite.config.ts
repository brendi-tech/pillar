import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({ include: ['src'] })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PillarVue',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'index.esm.js' : 'index.js'
    },
    rollupOptions: {
      external: ['vue', '@pillar-ai/sdk'],
      output: {
        globals: {
          vue: 'Vue',
          '@pillar-ai/sdk': 'PillarSDK'
        }
      }
    }
  }
})
