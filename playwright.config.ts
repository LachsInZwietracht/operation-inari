import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Load Supabase env vars for the test run.
 *
 * Prefers `.env.test` when present so the E2E suite targets a dedicated
 * local/throwaway Supabase instead of whatever `.env.local` points at — which
 * is typically the live cloud project, where the fixtures (test users,
 * patients, appointments) would otherwise be written. Falls back to
 * `.env.local` only when no `.env.test` exists, preserving prior behavior.
 * Existing `process.env` values always win, so CI can override either file.
 */
function loadEnvFile(fileName: string): boolean {
  const envPath = resolve(__dirname, fileName);
  if (!existsSync(envPath)) return false;
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) process.env[key] = value;
  }
  return true;
}

const loadedEnvFile = loadEnvFile(".env.test")
  ? ".env.test"
  : loadEnvFile(".env.local")
    ? ".env.local"
    : null;

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(
  /^(https?:\/\/[^.]+).*/,
  "$1…",
);
console.log(
  loadedEnvFile
    ? `[playwright] Loaded env from ${loadedEnvFile} → Supabase ${supabaseHost ?? "(unset)"}`
    : "[playwright] No .env.test or .env.local found; using process env only",
);

const STORAGE_STATE = "tests/.auth/user.json";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "line",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3000",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    /* Auth setup — runs once before all test projects */
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },
    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
