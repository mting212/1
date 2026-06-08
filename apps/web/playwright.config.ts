import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E configuration for MeetFlow
 *
 * Start the dev server before running:
 *   pnpm dev  (or turbo dev)
 *
 * Then run tests:
 *   npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30000,
  expect: { timeout: 10000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start dev server automatically (skip in CI — use separately started server)
  webServer: {
    command: "cd ../.. && pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
