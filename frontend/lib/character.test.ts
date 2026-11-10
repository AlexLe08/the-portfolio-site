import * as Sentry from "@sentry/nextjs";
import { unstable_cache } from "next/cache";
import { publicConfig } from "@solution-nine/wol-character-panel";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiBaseUrl } from "./api";
import { CACHE_TAGS } from "./cache-tags";
import { characterConfig, fetchSavedCharacterConfig, getCharacterConfig } from "./character";
import bundledConfig from "./character-config.json";

// A deploy's commit, set before the modules under test read it.
vi.hoisted(() => {
  process.env.VERCEL_GIT_COMMIT_SHA = "deploy-sha";
});
afterAll(() => {
  delete process.env.VERCEL_GIT_COMMIT_SHA;
});

// Same setup as lib/content.test.ts: unstable_cache wraps the function in a
// spy that calls straight through to the mocked backend.
vi.mock("next/cache", () => ({ unstable_cache: vi.fn((fn) => vi.fn(fn)) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./api", () => ({ api: { GET: vi.fn() }, apiBaseUrl: "http://backend.test" }));

// Vitest clears mock calls before each test, so keep the ones made when
// lib/character.ts was imported.
const cacheCalls = [...vi.mocked(unstable_cache).mock.calls];
const cached = vi.mocked(unstable_cache).mock.results[0]?.value;

function answer(status: number, config?: unknown) {
  vi.mocked(api.GET).mockResolvedValue({
    data: config === undefined ? undefined : { config },
    response: new Response(null, { status }),
  } as never);
}

// A saved copy that differs from the bundled file, so the tests can tell
// which one came back.
function savedCopy() {
  const config = structuredClone(bundledConfig) as unknown as { jobs: { name: string }[] };
  config.jobs[0].name = "Saved name";
  return config;
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the character sheet cache", () => {
  it("is tagged, expires, and keys on the backend URL", () => {
    const call = cacheCalls.find(([fn]) => fn === fetchSavedCharacterConfig);
    expect(call).toBeDefined();
    const [, keyParts, options] = call!;
    expect(keyParts).toContain(apiBaseUrl);
    // Per deploy, so an older deploy's data never reaches newer code.
    expect(keyParts).toContain("deploy-sha");
    expect(options?.tags).toEqual([CACHE_TAGS.characterSheet]);
    expect(options?.revalidate).toBeGreaterThan(0);
  });
});

describe("fetchSavedCharacterConfig", () => {
  it("returns the saved copy unparsed", async () => {
    const saved = savedCopy();
    answer(200, saved);
    await expect(fetchSavedCharacterConfig()).resolves.toBe(saved);
  });

  it("returns null when nothing is saved, so the answer gets cached", async () => {
    answer(404);
    await expect(fetchSavedCharacterConfig()).resolves.toBeNull();
  });

  it("throws on an HTTP error", async () => {
    answer(500);
    await expect(fetchSavedCharacterConfig()).rejects.toThrow("HTTP 500");
  });

  it("throws when the backend is unreachable", async () => {
    vi.mocked(api.GET).mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchSavedCharacterConfig()).rejects.toThrow("Backend unreachable");
  });
});

describe("getCharacterConfig", () => {
  it("returns the saved copy, published jobs only", async () => {
    const saved = savedCopy();
    answer(200, saved);

    const result = await getCharacterConfig();

    expect(cached).toHaveBeenCalledTimes(1);
    expect(result.fallback).toBe(false);
    expect(result.config.jobs[0].name).toBe("Saved name");
    expect(result.config.jobs.every((job) => job.status === "published")).toBe(true);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("shows the bundled file, not as a fallback, when nothing is saved", async () => {
    answer(404);

    const result = await getCharacterConfig();

    expect(result).toEqual({ config: publicConfig(characterConfig), fallback: false });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("falls back without reporting when the backend is unreachable", async () => {
    vi.mocked(api.GET).mockRejectedValue(new TypeError("fetch failed"));

    const result = await getCharacterConfig();

    expect(result).toEqual({ config: publicConfig(characterConfig), fallback: true });
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("falls back and reports an HTTP error once", async () => {
    answer(500);

    const result = await getCharacterConfig();

    expect(result).toEqual({ config: publicConfig(characterConfig), fallback: true });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "HTTP 500" }),
      expect.anything(),
    );
  });
});
