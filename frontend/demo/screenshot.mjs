// A full-page screenshot of one page on the demo stack (see stack.mjs:
// production build, throwaway seeded database), signed in first when the
// page is under /admin. For checking a layout without recording a video.
//
// From frontend/:
//   node demo/screenshot.mjs /admin/character-sheet
//   node demo/screenshot.mjs "/?job=ecommerce" --no-build
// Writes .logs/screenshot-<page>.png. --no-build reuses .next, which must
// hold a build pointed at localhost:8000 (a stack.mjs build is; a plain
// `npm run build` may point at production through .env.local).
import path from "node:path";
import { chromium, LOGS, login, startStack } from "./stack.mjs";

const args = process.argv.slice(2);
const target = args.find((arg) => arg.startsWith("/"));
if (!target) {
  console.error("usage: node demo/screenshot.mjs <path starting with /> [--no-build]");
  process.exit(1);
}

const stack = await startStack({ build: !args.includes("--no-build") });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  if (target.startsWith("/admin")) await login(page, stack);
  await page.goto(`${stack.baseUrl}${target}`, { waitUntil: "networkidle" });
  // Admin pages stream: the load event can fire while app/admin/loading.tsx
  // still shows. Resolves at once on pages without it.
  await page.getByText("Loading. If the server is asleep").waitFor({ state: "detached" });
  const name = target.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
  const out = path.join(LOGS, `screenshot-${name}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(out);
} finally {
  await browser.close();
  await stack.stop();
}
