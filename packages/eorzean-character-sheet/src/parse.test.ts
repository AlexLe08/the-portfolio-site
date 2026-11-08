import { describe, expect, it } from "vitest";
import { findUnknownKeys, loadConfig, parseConfig, type ConfigSource } from "./parse";
import type { CharacterSheetConfig } from "./types";

// Raw input, as a JSON file or the API would give it: plain objects, so a
// test can break any field. zod's own messages aren't asserted, only the
// path each error starts with; this package's messages are.

type Raw = Record<string, unknown>;

function rawJob(id: string, extra: Raw = {}): Raw {
  return {
    id,
    name: id,
    title: `Developer (${id})`,
    level: { label: "Lv.", value: "1" },
    slots: { skills: { tooltip: { title: "Skills" }, action: { kind: "none" } } },
    ...extra,
  };
}

function rawConfig(extra: Raw = {}): Raw {
  return {
    defaultJobId: "web",
    slots: [
      { id: "skills", label: "Skills", position: "left" },
      { id: "title", label: "Title", position: "header-start" },
    ],
    jobs: [rawJob("web"), rawJob("data")],
    ...extra,
  };
}

const jobIds = (config: CharacterSheetConfig | null) => config?.jobs.map((job) => job.id);

describe("parseConfig", () => {
  it("accepts a valid config without errors", () => {
    const { config, errors } = parseConfig(rawConfig());
    expect(errors).toEqual([]);
    expect(config?.defaultJobId).toBe("web");
    expect(jobIds(config)).toEqual(["web", "data"]);
  });

  it("defaults a job's status to published", () => {
    expect(parseConfig(rawConfig()).config?.jobs[0].status).toBe("published");
  });

  it("strips unknown keys instead of dropping the job", () => {
    const { config, errors } = parseConfig(rawConfig({ jobs: [rawJob("web", { subtitel: "typo" })], extra: 1 }));
    expect(errors).toEqual([]);
    expect(config?.jobs[0]).not.toHaveProperty("subtitel");
    expect(config).not.toHaveProperty("extra");
  });

  describe("the shell (everything but the jobs)", () => {
    it("returns no config when the input isn't an object", () => {
      const { config, errors } = parseConfig("not a config");
      expect(config).toBeNull();
      expect(errors).toEqual([expect.stringMatching(/^\(root\): /)]);
    });

    it("returns no config for a bad top-level field, with its path", () => {
      const { config, errors } = parseConfig(rawConfig({ slots: [] }));
      expect(config).toBeNull();
      expect(errors).toEqual([expect.stringMatching(/^slots: /)]);
    });

    it("returns no config without jobs", () => {
      expect(parseConfig(rawConfig({ jobs: [] })).config).toBeNull();
    });

    it("reports a duplicate slot id but keeps the config", () => {
      const slots = [...(rawConfig().slots as Raw[]), { id: "skills", label: "Again", position: "right" }];
      const { config, errors } = parseConfig(rawConfig({ slots }));
      expect(errors).toEqual(['slots: duplicate id "skills"']);
      expect(config).not.toBeNull();
    });

    it("reports a second slot in a header position", () => {
      const slots = [
        ...(rawConfig().slots as Raw[]),
        { id: "rank", label: "Rank", position: "header-start" },
        { id: "end", label: "End", position: "header-end" },
      ];
      expect(parseConfig(rawConfig({ slots })).errors).toEqual([
        'slots: "rank" is a second header-start slot, not shown',
      ]);
    });
  });

  describe("jobs, checked one at a time", () => {
    it("drops an invalid job with errors under its index and keeps the rest", () => {
      const { config, errors } = parseConfig(rawConfig({ jobs: [rawJob("web"), rawJob("data", { level: {} })] }));
      expect(jobIds(config)).toEqual(["web"]);
      expect(errors.length).toBeGreaterThan(0);
      for (const error of errors) expect(error).toMatch(/^jobs\.1\.level\./);
    });

    it("drops a job whose id repeats an earlier one", () => {
      const { config, errors } = parseConfig(rawConfig({ jobs: [rawJob("web"), rawJob("web", { name: "Again" })] }));
      expect(config?.jobs.map((job) => job.name)).toEqual(["web"]);
      expect(errors).toEqual(['jobs.1: duplicate id "web", dropped']);
    });

    it("keeps a job that fills an unknown slot, and says the content is ignored", () => {
      const slots = { ...(rawJob("web").slots as Raw), ghost: { tooltip: { title: "Ghost" }, action: { kind: "none" } } };
      const { config, errors } = parseConfig(rawConfig({ jobs: [rawJob("web", { slots })] }));
      expect(jobIds(config)).toEqual(["web"]);
      expect(errors).toEqual(['jobs.0.slots: unknown slot "ghost", ignored']);
    });

    it("returns no config when no job is valid", () => {
      const { config, errors } = parseConfig(rawConfig({ jobs: [rawJob("Bad Id")] }));
      expect(config).toBeNull();
      expect(errors.at(-1)).toBe("jobs: no valid job");
      expect(errors[0]).toMatch(/^jobs\.0\.id: /);
    });

    it("returns no config when no job is published", () => {
      const jobs = [rawJob("web", { status: "draft" }), rawJob("data", { status: "hidden" })];
      const { config, errors } = parseConfig(rawConfig({ jobs }));
      expect(config).toBeNull();
      expect(errors).toEqual(["jobs: no published job"]);
    });

    it("keeps drafts and hidden jobs for editors", () => {
      const jobs = [rawJob("web"), rawJob("data", { status: "draft" }), rawJob("old", { status: "hidden" })];
      expect(jobIds(parseConfig(rawConfig({ jobs })).config)).toEqual(["web", "data", "old"]);
    });
  });

  describe("defaultJobId", () => {
    const jobs = [rawJob("draft", { status: "draft" }), rawJob("data"), rawJob("web")];

    it("falls back to the first published job when no job has the id", () => {
      const { config, errors } = parseConfig(rawConfig({ defaultJobId: "gone", jobs }));
      expect(config?.defaultJobId).toBe("data");
      expect(errors).toEqual(['defaultJobId: no valid job "gone", using "data"']);
    });

    it("falls back without a second error when the default job was dropped", () => {
      const { config, errors } = parseConfig(rawConfig({ defaultJobId: "web", jobs: [rawJob("web", { level: {} }), rawJob("data")] }));
      expect(config?.defaultJobId).toBe("data");
      expect(errors.length).toBeGreaterThan(0);
      for (const error of errors) expect(error).toMatch(/^jobs\.0\./);
    });

    it("falls back when the default job isn't published", () => {
      const { config, errors } = parseConfig(rawConfig({ defaultJobId: "draft", jobs }));
      expect(config?.defaultJobId).toBe("data");
      expect(errors).toEqual(['defaultJobId: "draft" is draft, not published, using "data"']);
    });
  });
});

describe("findUnknownKeys", () => {
  function unknownKeys(raw: Raw): string[] {
    const { config, errors } = parseConfig(raw);
    expect(errors).toEqual([]);
    return findUnknownKeys(raw, config);
  }

  it("finds nothing in a config the schema fully knows", () => {
    expect(unknownKeys(rawConfig())).toEqual([]);
  });

  it("names each unknown key by its dotted path, array indexes included, in the input's order", () => {
    const slots = { skills: { tooltip: { title: "Skills", subtitel: "typo" }, action: { kind: "none" } } };
    const raw = rawConfig({ jobs: [rawJob("web"), rawJob("data", { slots })], titel: "typo" });
    expect(unknownKeys(raw)).toEqual(["jobs.1.slots.skills.tooltip.subtitel", "titel"]);
  });

  it("reports an unknown key without looking inside it", () => {
    expect(unknownKeys(rawConfig({ extra: { nested: true } }))).toEqual(["extra"]);
  });

  it("reports a key named like an Object.prototype property", () => {
    expect(unknownKeys(rawConfig({ constructor: "x", toString: "y" }))).toEqual(["constructor", "toString"]);
  });

  it("ignores values that aren't objects or arrays", () => {
    expect(findUnknownKeys("text", null)).toEqual([]);
    expect(findUnknownKeys({ a: 1 }, null)).toEqual([]);
  });
});

describe("loadConfig", () => {
  const fallback = parseConfig(rawConfig({ defaultJobId: "fallback", jobs: [rawJob("fallback")] })).config!;
  const source = (name: string, load: () => unknown): ConfigSource => ({ name, load: async () => load() });

  it("uses the first source with a usable config", async () => {
    const result = await loadConfig(
      [source("api", () => rawConfig()), source("cms", () => rawConfig({ defaultJobId: "data" }))],
      fallback,
    );
    expect(result.source).toBe("api");
    expect(result.config.defaultJobId).toBe("web");
    expect(result.issues).toEqual([]);
  });

  it("moves on quietly from a source with nothing yet", async () => {
    const result = await loadConfig([source("api", () => undefined), source("cms", () => rawConfig())], fallback);
    expect(result.source).toBe("cms");
    expect(result.issues).toEqual([]);
  });

  it("records a source that throws, with the error, and moves on", async () => {
    const failure = new Error("HTTP 503");
    const result = await loadConfig(
      [
        source("api", () => {
          throw failure;
        }),
        source("cms", () => rawConfig()),
      ],
      fallback,
    );
    expect(result.source).toBe("cms");
    expect(result.issues).toEqual([{ source: "api", errors: ["Error: HTTP 503"], error: failure }]);
  });

  it("uses a source with errors when it still has a config, and records them", async () => {
    const result = await loadConfig(
      [source("api", () => rawConfig({ jobs: [rawJob("web"), rawJob("web")] }))],
      fallback,
    );
    expect(result.source).toBe("api");
    expect(result.issues).toEqual([{ source: "api", errors: ['jobs.1: duplicate id "web", dropped'] }]);
  });

  it("records an unusable source and moves on", async () => {
    const result = await loadConfig([source("api", () => ({ jobs: [] })), source("cms", () => rawConfig())], fallback);
    expect(result.source).toBe("cms");
    expect(result.issues.map((issue) => issue.source)).toEqual(["api"]);
    expect(result.issues[0].errors.length).toBeGreaterThan(0);
  });

  it("falls back, with every issue, when no source works", async () => {
    const result = await loadConfig(
      [
        source("api", () => {
          throw new Error("down");
        }),
        source("cms", () => "garbage"),
      ],
      fallback,
    );
    expect(result).toMatchObject({ config: fallback, source: null });
    expect(result.issues.map((issue) => issue.source)).toEqual(["api", "cms"]);
  });

  it("falls back without issues when no source has anything yet", async () => {
    const result = await loadConfig([source("api", () => undefined)], fallback);
    expect(result).toEqual({ config: fallback, source: null, issues: [] });
  });
});
