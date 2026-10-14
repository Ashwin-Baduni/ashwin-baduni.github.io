import { defineConfig, devices } from "@playwright/test";

/*
  Browser checks for the scroll stories, run against the production build.

  npm run test:e2e builds and serves dist/ on port 4174 (the review preview keeps 4173).
  BASE_URL=http://host:port runs the same checks against another server, for example the
  pre-audit baseline. Each test runs in a fresh, isolated browser context; no personal browser
  profile is ever used. Hosts without WebKit's system libraries can opt in to skipping
  Playwright's host check with PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1.
*/
const external = process.env.BASE_URL;
const phone = { viewport: { width: 412, height: 812 }, deviceScaleFactor: 1 };
const wide = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 240_000,
  expect: { timeout: 10_000 },
  // Four browsers at a time (about 3 GB) keeps memory use modest on this machine.
  workers: 4,
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: external ?? "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  projects: [
    // The full Chromium build in its new headless mode, which composites like the browser.
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium", ...phone, isMobile: true, hasTouch: true }, testIgnore: /(strict|desktop|desktop-settle|wide-layouts)\.spec\.ts/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"], ...phone }, testIgnore: /(strict|desktop|desktop-settle|wide-layouts)\.spec\.ts/ },
    { name: "webkit", use: { ...devices["Desktop Safari"], ...phone, isMobile: true, hasTouch: true }, testIgnore: /(strict|desktop|desktop-settle|wide-layouts)\.spec\.ts/ },
    // Desktop: the shared story checks, composited frames and gestures, and MihawkAI's row
    // (desktop.spec.ts), which Firefox and WebKit also run.
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chromium", ...wide }, testMatch: /(story|keyboard|contact|links|frames|motion|desktop|product-adaptation|product-rest-state|desktop-settle|wide-layouts)\.spec\.ts/ },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"], ...wide }, testMatch: /(desktop|desktop-settle|wide-layouts)\.spec\.ts/ },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"], ...wide }, testMatch: /(desktop|desktop-settle|wide-layouts)\.spec\.ts/ },
    // React StrictMode mounts, cleans up and mounts again in development: the dev server shows
    // whether any observer, probe or animation survives its cleanup.
    ...(external ? [] : [{ name: "strict", use: { ...devices["Desktop Chrome"], channel: "chromium", ...phone, isMobile: true, hasTouch: true, baseURL: "http://127.0.0.1:4176" }, testMatch: /strict\.spec\.ts/ }]),
  ],
  testIgnore: external ? /strict\.spec\.ts/ : undefined,
  webServer: external
    ? undefined
    : [
        {
          command: "npx vite preview --port 4174 --strictPort --host 127.0.0.1",
          url: "http://127.0.0.1:4174",
          reuseExistingServer: false,
          timeout: 60_000,
        },
        {
          command: "npx vite --port 4176 --strictPort --host 127.0.0.1",
          url: "http://127.0.0.1:4176",
          reuseExistingServer: false,
          timeout: 60_000,
        },
      ],
});
