import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer')
      }
    },
    plugins: [react()],
    build: {
      sourcemap: true,
      minify: false,
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') }
      }
    }
  }
})
