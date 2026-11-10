import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { CACHE_TAGS } from "./cache-tags";
import { revalidatePublic } from "./revalidate-public";

// server-only throws outside a React Server Component build.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

describe("revalidatePublic", () => {
  it.each(Object.values(CACHE_TAGS))("marks %s stale with the max profile", (tag) => {
    revalidatePublic(tag);

    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith(tag, "max");
  });

  it("revalidates every tag it's given", () => {
    revalidatePublic(CACHE_TAGS.content, CACHE_TAGS.projects);

    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      [CACHE_TAGS.content, "max"],
      [CACHE_TAGS.projects, "max"],
    ]);
  });

  it("does nothing without tags", () => {
    revalidatePublic();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
