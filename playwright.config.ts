import { defineConfig, devices } from '@playwright/test';

// E2E harness (plan D17). Runs at gates (G3/G4/G6) and nightly in CI — NOT on
// every PR (see .github/workflows/e2e.yml). Locally it boots `npm run dev`.
const PORT = 3000;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // Give locale redirects room on a cold server without masking real hangs.
  expect: { timeout: 15_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Start the app unless we're pointed at an already-running/remote server.
  // Production build (not dev) → no per-route compile latency, matches CI.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run start',
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
