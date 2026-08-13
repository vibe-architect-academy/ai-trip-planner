import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Fail the run if a test was left with .only, which is the classic way a
  // suite silently stops testing anything.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    // Only kept for failures. Recording every passing run produces gigabytes
    // nobody will ever open.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // The phone is most of the traffic, so it is a real target rather than
    // something checked by hand occasionally.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        /*
         * Deliberately not /api/health.
         *
         * That endpoint answers 503 when a dependency is unconfigured, which
         * is correct and also means Playwright would wait forever for a
         * server that is up and serving perfectly well. This is the same
         * readiness-versus-liveness distinction as the Kubernetes probes:
         * "is it listening" and "is everything healthy" are different
         * questions, and this one only needs the first.
         */
        url: "http://127.0.0.1:3000/api/destinations",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
