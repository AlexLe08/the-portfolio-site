import { defineConfig } from "vitest/config";

// Unit tests for lib/ helpers. Without `include`, vitest would also pick up
// e2e/smoke.spec.ts, the Playwright suite that loads production.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
