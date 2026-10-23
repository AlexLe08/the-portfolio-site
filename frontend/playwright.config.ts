import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against a deployed site, production by default (see
// .github/workflows/smoke.yml). Point them elsewhere with BASE_URL and
// API_URL, e.g. a local `npm run dev` plus uvicorn.
export default defineConfig({
  testDir: "./e2e",
  // Render's free tier sleeps after 15 idle minutes and takes 30-50s to
  // wake, so the first backend call needs room.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "https://the-portfolio-site-flax.vercel.app",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
