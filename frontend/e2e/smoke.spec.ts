import { expect, test } from "@playwright/test";

// Read-only checks against a deployed site, plus one contact submission
// with the honeypot filled: the backend counts it toward the rate limit
// but saves and sends nothing. Assertions avoid specific content (project
// titles, copy) so editing content in /admin never breaks them.
const API_URL = process.env.API_URL ?? "https://portfolio-backend-leto.onrender.com";

// Runs first and wakes Render, so the page tests don't each wait for it.
test.beforeAll(async ({ request }) => {
  const response = await request.get(`${API_URL}/health`, { timeout: 90_000 });
  expect(response.ok()).toBe(true);
  expect((await response.json()).status).toBe("ok");
});

test("home page lists projects", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Alexander Le" })).toBeVisible();
  await expect(page.locator(".project-list a[href^='/projects/']").first()).toBeVisible();
});

test("project page renders its case study", async ({ page }) => {
  await page.goto("/");
  const link = page.locator(".project-list a[href^='/projects/']").first();
  const title = (await link.locator(".project-card__title").textContent())?.trim();
  await link.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title ?? "");
  await expect(page).toHaveTitle(`${title} — Alexander Le`);
  await expect(page.locator("article.case-study")).not.toBeEmpty();
});

test("unknown project is a 404", async ({ page }) => {
  const response = await page.goto("/projects/smoke-test-no-such-project");

  expect(response?.status()).toBe(404);
});

test("contact form reaches the backend cross-origin", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Name").fill("Smoke test");
  await page.getByLabel("Email").fill("smoke-test@example.com");
  await page.getByLabel("Message").fill("Automated smoke test (honeypot filled, discarded).");
  // Off-screen and aria-hidden, so it has to be forced.
  await page.locator("#website").fill("smoke-test", { force: true });

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/contact") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Send message" }).click(),
  ]);

  expect(response.status()).toBe(201);
  // ContactForm reads Retry-After on a 429, which only works if CORS exposes it.
  expect(response.headers()["access-control-expose-headers"]).toMatch(/retry-after/i);
  await expect(page.getByRole("status")).toContainText("Message sent");
});

test("admin redirects to sign in and is not indexed", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
});
