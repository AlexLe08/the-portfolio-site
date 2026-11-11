import { defineConfig } from "vitest/config";

// Unit tests for lib/ helpers. Without `include`, vitest would also pick up
// e2e/smoke.spec.ts, the Playwright suite that loads production.
// tsconfigPaths resolves the "@/" imports of the app/ modules a test loads
// (the admin Server Actions).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
