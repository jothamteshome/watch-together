import { defineConfig, devices } from '@playwright/test'
import { BACKEND_PORT, BACKEND_URL, FRONTEND_PORT, FRONTEND_URL } from './e2e/servers'

// https://playwright.dev/docs/test-configuration
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: FRONTEND_URL,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // Multi-user sync and navigation don't depend on the viewport, so mobile only runs the layout checks
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: 'layout.spec.ts' },
  ],
  webServer: [
    {
      // The real backend, as the backend contract suite runs it
      command: 'npx tsx src/server.ts',
      cwd: '../backend',
      env: { BACKEND_PORT: String(BACKEND_PORT) },
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: false,
    },
    {
      // A production build: dev mode's StrictMode double-mounts the room and joins it twice
      command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --host 127.0.0.1 --port ${FRONTEND_PORT} --strictPort`,
      env: { VITE_APP_BACKEND_URL: BACKEND_URL },
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
