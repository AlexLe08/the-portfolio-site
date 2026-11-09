import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "./admin-api";
import { loadCharacterSheetForAdmin } from "./character-admin";
import bundledConfig from "./character-config.json";

// server-only throws outside a React Server Component build; adminApi()
// checks the session cookie. Each test sets what GET /character-sheet answers.
vi.mock("server-only", () => ({}));
vi.mock("./admin-api", () => ({ adminApi: vi.fn() }));

function answer(status: number, config?: unknown) {
  const GET = vi.fn().mockResolvedValue({
    data: config === undefined ? undefined : { config },
    response: new Response(null, { status }),
  });
  vi.mocked(adminApi).mockResolvedValue({ GET } as unknown as Awaited<ReturnType<typeof adminApi>>);
  return GET;
}

// The bundled config with one job's first slot changed, so every check has
// something to find.
function withFirstSlot(change: (slot: Record<string, unknown>) => void) {
  const config = structuredClone(bundledConfig) as unknown as {
    jobs: { slots: Record<string, Record<string, unknown>> }[];
  };
  const slots = config.jobs[0].slots;
  change(slots[Object.keys(slots)[0]]);
  return config;
}

beforeEach(() => {
  vi.mocked(adminApi).mockReset();
});

describe("loadCharacterSheetForAdmin", () => {
  it("returns the stored copy as stored", async () => {
    const stored = withFirstSlot((slot) => {
      slot.typo = true;
    });
    const GET = answer(200, stored);

    const result = await loadCharacterSheetForAdmin();

    expect(GET).toHaveBeenCalledWith("/character-sheet");
    expect(result.config).toBe(stored);
    expect(result.stored).toBe(JSON.stringify(stored));
    expect(result.bundled).toBe(JSON.stringify(bundledConfig));
    expect(result.parsed.errors).toEqual([]);
    expect(result.unknownKeys).toEqual([expect.stringContaining("typo")]);
  });

  it("starts from the bundled file when nothing is saved yet", async () => {
    answer(404);

    const result = await loadCharacterSheetForAdmin();

    expect(result.config).toBe(bundledConfig);
    expect(result.stored).toBeNull();
    expect(result.parsed.errors).toEqual([]);
    expect(result).toMatchObject({ unknownKeys: [], deadAnchors: [], deadParams: [] });
  });

  it.each([401, 500, 503])("throws on HTTP %i instead of falling back", async (status) => {
    answer(status);
    await expect(loadCharacterSheetForAdmin()).rejects.toThrow(`(HTTP ${status})`);
  });

  it("flags anchors and params the home page doesn't use", async () => {
    answer(200, withFirstSlot((slot) => {
      slot.action = { kind: "anchor", target: "nowhere" };
    }));
    expect((await loadCharacterSheetForAdmin()).deadAnchors).not.toEqual([]);

    answer(200, withFirstSlot((slot) => {
      slot.action = { kind: "param", name: "unused", value: "x", target: "projects" };
    }));
    expect((await loadCharacterSheetForAdmin()).deadParams).not.toEqual([]);
  });

  it("skips the checks while the stored copy has errors", async () => {
    // Each check would flag something here if it ran.
    const stored = withFirstSlot((slot) => {
      slot.typo = true;
      slot.action = { kind: "anchor", target: "nowhere" };
    }) as unknown as Record<string, unknown>;
    stored.defaultJobId = "missing";
    answer(200, stored);

    const result = await loadCharacterSheetForAdmin();

    expect(result.parsed.errors).not.toEqual([]);
    expect(result.parsed.config).not.toBeNull();
    expect(result).toMatchObject({ unknownKeys: [], deadAnchors: [], deadParams: [] });
  });
});
