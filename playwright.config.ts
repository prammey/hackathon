import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 60_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: "evidence/e2e/results.json" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  outputDir: "test-results",
  webServer: {
    command: "node scripts/fixtures-server.mjs",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: true,
  },
});
