import * as Sentry from "@sentry/nextjs";
import { unstable_cache } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiBaseUrl } from "./api";
import { CACHE_TAGS } from "./cache-tags";
import {
  fetchProject,
  fetchProjects,
  getProject,
  loadProjects,
  loadProjectsLive,
} from "./projects";

// Same setup as lib/content.test.ts: unstable_cache wraps the function in a
// spy that calls straight through to the mocked backend.
vi.mock("next/cache", () => ({ unstable_cache: vi.fn((fn) => vi.fn(fn)) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./api", () => ({ api: { GET: vi.fn() }, apiBaseUrl: "http://backend.test" }));

// Vitest clears mock calls before each test, so keep the ones made when
// lib/projects.ts was imported, and the wrapper each one returned.
const cacheCalls = [...vi.mocked(unstable_cache).mock.calls];
const wrappers = vi.mocked(unstable_cache).mock.results.map((result) => result.value);

function wrapperOf(fn: unknown) {
  return wrappers[cacheCalls.findIndex(([cachedFn]) => cachedFn === fn)];
}

const PROJECTS = [{ slug: "one", title: "One" }];
const PROJECT = { slug: "one", title: "One", case_study_md: "# One" };

function answer(status: number, data?: unknown) {
  vi.mocked(api.GET).mockResolvedValue({
    data,
    error: data === undefined ? { detail: "boom" } : undefined,
    response: new Response(null, { status }),
  } as never);
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
});

describe("the project caches", () => {
  it.each([
    ["list", fetchProjects],
    ["detail", fetchProject],
  ])("%s is tagged, expires, and keys on the backend URL", (_, fn) => {
    const call = cacheCalls.find(([cachedFn]) => cachedFn === fn);
    expect(call).toBeDefined();
    const [, keyParts, options] = call!;
    expect(keyParts).toContain(apiBaseUrl);
    expect(options?.tags).toEqual([CACHE_TAGS.projects]);
    expect(options?.revalidate).toBeGreaterThan(0);
  });

  it("list and detail have different keys", () => {
    const keys = cacheCalls.map(([, keyParts]) => JSON.stringify(keyParts));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("fetchProjects", () => {
  it("returns the list", async () => {
    answer(200, PROJECTS);
    await expect(fetchProjects()).resolves.toEqual(PROJECTS);
  });

  it("throws on an HTTP error, so nothing gets cached", async () => {
    answer(500);
    await expect(fetchProjects()).rejects.toThrow("Failed to load projects");
  });
});

describe("loadProjects", () => {
  it("returns the list through the cache", async () => {
    answer(200, PROJECTS);

    await expect(loadProjects()).resolves.toEqual(PROJECTS);
    expect(wrapperOf(fetchProjects)).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns null and reports an HTTP error once", async () => {
    answer(500);

    await expect(loadProjects()).resolves.toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: { error: { detail: "boom" } },
    });
  });

  it("returns null and reports an unreachable backend", async () => {
    const error = new TypeError("fetch failed");
    vi.mocked(api.GET).mockRejectedValue(error);

    await expect(loadProjects()).resolves.toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledWith(error, undefined);
  });
});

describe("loadProjectsLive", () => {
  it("reads the backend, never the cache", async () => {
    answer(200, PROJECTS);

    await expect(loadProjectsLive()).resolves.toEqual(PROJECTS);
    expect(api.GET).toHaveBeenCalledTimes(1);
    expect(wrappers.every((wrapper) => wrapper.mock.calls.length === 0)).toBe(true);
  });

  it("returns null on a failure", async () => {
    answer(500);
    await expect(loadProjectsLive()).resolves.toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});

describe("fetchProject", () => {
  it("returns the project", async () => {
    answer(200, PROJECT);

    await expect(fetchProject("one")).resolves.toEqual(PROJECT);
    expect(api.GET).toHaveBeenCalledWith("/projects/{slug}", { params: { path: { slug: "one" } } });
  });

  it("returns null on a 404, so the answer gets cached", async () => {
    answer(404);
    await expect(fetchProject("gone")).resolves.toBeNull();
  });

  it("throws on any other HTTP error", async () => {
    answer(500);
    await expect(fetchProject("one")).rejects.toThrow("Failed to load project");
  });
});

describe("getProject", () => {
  it("reads through the cache, keyed by slug", async () => {
    answer(200, PROJECT);

    await expect(getProject("one")).resolves.toEqual(PROJECT);
    expect(wrapperOf(fetchProject)).toHaveBeenCalledWith("one");
  });

  it("lets failures through for the page's error boundary", async () => {
    answer(500);

    await expect(getProject("broken")).rejects.toThrow("Failed to load project");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
