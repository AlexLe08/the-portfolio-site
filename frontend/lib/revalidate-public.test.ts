import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { CACHE_TAGS } from "./cache-tags";
import { revalidatePublic } from "./revalidate-public";

// server-only throws outside a React Server Component build.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

describe("revalidatePublic", () => {
  it("marks every tag it's given stale with the max profile", () => {
    const tags = Object.values(CACHE_TAGS);
    revalidatePublic(...tags);

    expect(vi.mocked(revalidateTag).mock.calls).toEqual(tags.map((tag) => [tag, "max"]));
  });

  it("does nothing without tags", () => {
    revalidatePublic();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
