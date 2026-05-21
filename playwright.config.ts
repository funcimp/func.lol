import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // In-memory stand-in for Vercel Blob (see e2e/fake-blob.ts). Lets
      // proxy.ts (PUT events) and the tripwire page (GET stats) exercise
      // their real fetch paths without a token or network round-trip.
      command: "bun run e2e/fake-blob.ts",
      url: "http://localhost:7777/_health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      // Tripwire proxy is prod-gated by default (so local dev doesn't self-bomb).
      // TRIPWIRE_FORCE=1 overrides the gate for E2E tests. BLOB_BASE_URL
      // points the blob client at the fake; the token's value doesn't
      // matter to the fake, but the format has to satisfy the storeId
      // parser in aggregates.ts (token.split('_')[3]).
      env: {
        TRIPWIRE_FORCE: "1",
        BLOB_BASE_URL: "http://localhost:7777",
        BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_faketestbloblbs_dummy",
      },
    },
  ],
});
