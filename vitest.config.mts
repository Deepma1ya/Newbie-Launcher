import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
      electron: resolve('tests/mocks/electron.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
