import * as Sentry from "@sentry/nextjs";
import { unstable_cache } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiBaseUrl } from "./api";
import { CACHE_TAGS } from "./cache-tags";
import { FALLBACK_CONTENT, fetchContent, getContent } from "./content";

// unstable_cache wraps the function in a spy that calls straight through, so
// each call reaches the mocked backend; the tests check what it was given,
// and that the function it caches throws instead of returning a fallback.
vi.mock("next/cache", () => ({ unstable_cache: vi.fn((fn) => vi.fn(fn)) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./api", () => ({ api: { GET: vi.fn() }, apiBaseUrl: "http://backend.test" }));

// Vitest clears mock calls before each test, so keep the ones made when
// lib/content.ts was imported.
const cacheCalls = [...vi.mocked(unstable_cache).mock.calls];
const cached = vi.mocked(unstable_cache).mock.results[0]?.value;

function answer(status: number, data?: Record<string, string>) {
  vi.mocked(api.GET).mockResolvedValue({
    data,
    error: data === undefined ? { detail: "boom" } : undefined,
    response: new Response(null, { status }),
  } as never);
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  vi.mocked(Sentry.captureException).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the content cache", () => {
  it("is tagged, expires, and keys on the backend URL", () => {
    const call = cacheCalls.find(([fn]) => fn === fetchContent);
    expect(call).toBeDefined();
    const [, keyParts, options] = call!;
    expect(keyParts).toContain(apiBaseUrl);
    expect(options?.tags).toEqual([CACHE_TAGS.content]);
    expect(options?.revalidate).toBeGreaterThan(0);
  });

  it("is what getContent reads", async () => {
    answer(200, {});
    await getContent();
    expect(cached).toHaveBeenCalledTimes(1);
  });
});

describe("fetchContent", () => {
  it("returns the saved copy", async () => {
    answer(200, { "home.role": "Saved role" });
    await expect(fetchContent()).resolves.toEqual({ "home.role": "Saved role" });
  });

  it("throws on an HTTP error, so nothing gets cached", async () => {
    answer(500);
    await expect(fetchContent()).rejects.toThrow("Failed to load site content");
  });

  it("throws when the backend is unreachable", async () => {
    vi.mocked(api.GET).mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchContent()).rejects.toThrow("fetch failed");
  });
});

describe("getContent", () => {
  it("merges the saved copy over the built-in text, ignoring unknown keys", async () => {
    answer(200, { "home.role": "Saved role", "old.key": "x" });

    const result = await getContent();

    expect(result).toEqual({
      content: { ...FALLBACK_CONTENT, "home.role": "Saved role" },
      fallback: false,
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("falls back and reports an HTTP error once", async () => {
    answer(500);

    const result = await getContent();

    expect(result).toEqual({ content: FALLBACK_CONTENT, fallback: true });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: { error: { detail: "boom" } },
    });
  });

  it("falls back without reporting when the backend is unreachable", async () => {
    vi.mocked(api.GET).mockRejectedValue(new TypeError("fetch failed"));

    const result = await getContent();

    expect(result).toEqual({ content: FALLBACK_CONTENT, fallback: true });
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
