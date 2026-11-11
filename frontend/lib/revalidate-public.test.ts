import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { CACHE_TAGS } from "./cache-tags";
import { revalidatePublic } from "./revalidate-public";

// server-only throws outside a React Server Component build.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

describe("revalidatePublic", () => {
  it("marks every tag it's given stale with the max profile", () => {
    revalidatePublic(CACHE_TAGS.content, CACHE_TAGS.characterSheet, CACHE_TAGS.projects);

    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      [CACHE_TAGS.content, "max"],
      [CACHE_TAGS.characterSheet, "max"],
      [CACHE_TAGS.projects, "max"],
    ]);
  });

  it("does nothing without tags", () => {
    revalidatePublic();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
