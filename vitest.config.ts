import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["work/**", ".worktrees/**", "node_modules/**"],
  },
});
