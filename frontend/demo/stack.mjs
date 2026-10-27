// Helpers for recording a PR demo video: the whole site on a production
// build (no dev overlay in the video) against a throwaway seeded SQLite
// database, with the backend stoppable mid-recording to stage outages.
// Same isolation as scripts/local-stack.sh: shell variables override the
// .env files, so nothing touches production or sends notifications, and
// the Sentry DSN is blank.
//
// A per-PR script only needs this file (it re-exports chromium), so it can
// live outside the repo:
//
//   import { chromium, startStack, login, recordingContext, caption, pause, saveVideo }
//     from "<repo>/frontend/demo/stack.mjs";
//   const stack = await startStack();
//   const browser = await chromium.launch();
//   const context = await recordingContext(browser);
//   const page = await context.newPage();
//   try {
//     await login(page, stack);          // only for admin pages
//     await page.goto(stack.baseUrl);
//     await caption(page, "1. Projects listed");
//     await pause(3000);
//     await stack.backend.stop();   // stage an outage
//     ...
//   } finally {
//     await saveVideo(page, context, "pr-42-my-change");   // .logs/pr-42-my-change.webm
//     await browser.close();
//     await stack.stop();
//   }
//
// Assert each state before captioning it, so a broken flow fails instead
// of recording. Videos don't show the cursor; hover before a click.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export { chromium } from "playwright";

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.dirname(FRONTEND);
const BACKEND = path.join(ROOT, "backend");
export const LOGS = path.join(ROOT, ".logs");

const API_URL = "http://localhost:8000";
const BASE_URL = "http://localhost:3000";

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// run <command> <args> in <cwd>; rejects with the output if it fails.
function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env } });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed:\n${output}`)),
    );
  });
}

async function waitFor(url, what) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await pause(500);
  }
  throw new Error(`${what} did not start (${url})`);
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = createServer()
      .once("error", () => reject(new Error(`port ${port} is in use; stop that server first`)))
      .once("listening", () => server.close(resolve))
      .listen(port);
  });
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  return exited;
}

// A random admin password for one run, hashed the way the backend checks
// it, so login() never needs (or touches) the real ADMIN_PASSWORD_HASH.
function throwawayLogin() {
  const password = randomBytes(12).toString("hex");
  const hasher = spawnSync(
    "./.venv/bin/python",
    ["-c", "import sys; from argon2 import PasswordHasher; print(PasswordHasher().hash(sys.argv[1]))", password],
    { cwd: BACKEND, encoding: "utf8" },
  );
  if (hasher.status !== 0) throw new Error(`hashing the demo password failed:\n${hasher.stderr}`);
  return { password, hash: hasher.stdout.trim() };
}

// Seeds a throwaway database, builds the frontend (skip with build: false
// when .next already holds a build pointed at localhost:8000), and starts
// both apps. Returns { baseUrl, apiUrl, adminPassword, backend: { start,
// stop }, stop }.
export async function startStack({ build = true } = {}) {
  await assertPortFree(8000);
  await assertPortFree(3000);

  const dbDir = mkdtempSync(path.join(tmpdir(), "demo-db-"));
  const admin = throwawayLogin();
  const backendEnv = {
    DATABASE_URL: `sqlite:///${dbDir}/demo.db`,
    ALLOWED_ORIGINS: BASE_URL,
    DISCORD_WEBHOOK_URL: "",
    RESEND_API_KEY: "",
    NOTIFY_EMAIL_TO: "",
    CLIENT_IP_HEADER: "",
    SENTRY_DSN: "",
    ADMIN_PASSWORD_HASH: admin.hash,
    JWT_SECRET: randomBytes(32).toString("hex"),
  };
  const frontendEnv = { NEXT_PUBLIC_API_URL: API_URL, NEXT_PUBLIC_SENTRY_DSN: "" };

  await run("./.venv/bin/alembic", ["upgrade", "head"], BACKEND, backendEnv);
  await run("./.venv/bin/python", ["seed.py"], BACKEND, backendEnv);
  if (build) await run("npm", ["run", "build"], FRONTEND, frontendEnv);

  let uvicorn;
  const backend = {
    async start() {
      uvicorn = spawn("./.venv/bin/uvicorn", ["app.main:app", "--port", "8000"], {
        cwd: BACKEND,
        env: { ...process.env, ...backendEnv },
        stdio: "ignore",
      });
      await waitFor(`${API_URL}/health`, "backend");
    },
    stop: () => stopProcess(uvicorn),
  };
  await backend.start();

  const next = spawn("./node_modules/.bin/next", ["start", "-p", "3000"], {
    cwd: FRONTEND,
    env: { ...process.env, ...frontendEnv },
    stdio: "ignore",
  });
  await waitFor(`${BASE_URL}/contact`, "frontend");

  return {
    baseUrl: BASE_URL,
    apiUrl: API_URL,
    adminPassword: admin.password,
    backend,
    async stop() {
      await Promise.all([backend.stop(), stopProcess(next)]);
      rmSync(dbDir, { recursive: true, force: true });
    },
  };
}

// Signs in to the admin UI with the run's throwaway password and waits for
// the admin home page.
export async function login(page, stack) {
  await page.goto(`${stack.baseUrl}/admin/login`);
  await page.fill("#password", stack.adminPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(`${stack.baseUrl}/admin`);
}

// 1280x720 context that records a video; finish with saveVideo().
export function recordingContext(browser) {
  return browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: LOGS, size: { width: 1280, height: 720 } },
  });
}

// Closes the context (which finishes the video) and moves the video to
// .logs/<name>.webm.
export async function saveVideo(page, context, name) {
  const video = page.video();
  await context.close();
  if (video) renameSync(await video.path(), path.join(LOGS, `${name}.webm`));
}

// A fixed caption bar along the bottom of the page; call again to change it.
export function caption(page, text) {
  return page.evaluate((text) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      Object.assign(el.style, {
        position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "9999",
        padding: "14px 24px", background: "rgba(20,22,26,0.88)", color: "#fff",
        font: "500 18px/1.4 'IBM Plex Sans', system-ui, sans-serif", textAlign: "center",
      });
      document.body.appendChild(el);
    }
    el.textContent = text;
  }, text);
}
