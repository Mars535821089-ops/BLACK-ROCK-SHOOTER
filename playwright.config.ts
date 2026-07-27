import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  webServer: {
    command: "npm run preview -- --port 4173",
    port: 4173,
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 900 },
    ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "1"
      ? { channel: "chrome" }
      : {}),
  },
});
