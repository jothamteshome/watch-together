import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// https://vitest.dev/config/
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/support/setup.ts'],
    coverage: {
      include: ['src/**'],
      reporter: ['html', 'text-summary'],
      // The levels reached after the feature merge; raise them as coverage grows
      thresholds: { statements: 88, branches: 76, functions: 85, lines: 92 },
    },
  },
}))
