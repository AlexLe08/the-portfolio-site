import { refresh } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCharacterJob,
  removeCharacterJob,
  setDefaultCharacterJob,
  updateCharacterJob,
  updateCharacterSheet,
} from "@/app/admin/character-sheet/actions";
import { adminRequest } from "./admin-api";
import bundledConfig from "./character-config.json";
import { SERVER_UNREACHABLE } from "./messages";
import { revalidatePublic } from "./revalidate-public";

// The character sheet's Server Actions, with the real parseConfig. Only
// the backend (through adminRequest), Next's refresh and redirect, and the
// cache revalidation are mocked. redirect() throws, as the real one does.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), unstable_cache: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("./admin-api", () => ({ adminRequest: vi.fn() }));
vi.mock("./revalidate-public", () => ({ revalidatePublic: vi.fn() }));

type JsonObject = Record<string, unknown>;
type Job = JsonObject & {
  id: string;
  name: string;
  title: string;
  status?: string;
  icon?: string;
  level: { label: string; value: string };
  portrait?: JsonObject & { src: string; alt: string; framing: string };
  sections?: Record<string, string>;
  slots: Record<string, { tooltip: JsonObject; action: JsonObject }>;
};
type Config = JsonObject & { defaultJobId: string; jobs: Job[] };

// The bundled file is healthcare (the default) and ecommerce, both
// published and both filling every slot.
const BUNDLED_JSON = JSON.stringify(bundledConfig);

const api = { GET: vi.fn(), PUT: vi.fn() };

function config(): Config {
  return JSON.parse(BUNDLED_JSON);
}

function ok(status = 200) {
  return new Response(null, { status });
}

// What GET /character-sheet answers: a saved copy, or a status with no data.
function saved(stored: Config) {
  api.GET.mockResolvedValue({ data: { config: stored }, response: ok() });
}

function getFails(status: number) {
  api.GET.mockResolvedValue({ data: undefined, response: ok(status) });
}

function putFails(status: number, error: unknown) {
  api.PUT.mockResolvedValue({ data: undefined, error, response: ok(status) });
}

// The document the last PUT sent.
function sent(): Config {
  expect(api.PUT).toHaveBeenCalledTimes(1);
  const [path, { body }] = api.PUT.mock.calls[0];
  expect(path).toBe("/character-sheet");
  return body.config;
}

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of [value].flat()) data.append(name, item);
  }
  return data;
}

// The job form as the page renders it for this job, with no slot fields;
// fields replace or add to it.
function jobForm(job: Job, fields: Record<string, string | string[]> = {}) {
  const sections = Object.entries(job.sections ?? {}).map(([name, text]) => [`section.${name}`, text]);
  return form({
    name: job.name,
    title: job.title,
    status: job.status ?? "published",
    icon: job.icon ?? "",
    level_label: job.level.label,
    level_value: job.level.value,
    portrait_src: job.portrait?.src ?? "",
    portrait_alt: job.portrait?.alt ?? "",
    portrait_framing: job.portrait?.framing ?? "",
    ...Object.fromEntries(sections),
    ...fields,
  });
}

// One slot's tooltip and action fields, named as the editor names them.
function slotFields(slotId: string, tooltip: Record<string, string | string[]>, action?: Record<string, string>) {
  return {
    ...Object.fromEntries(Object.entries(tooltip).map(([name, value]) => [`tooltip.${slotId}.${name}`, value])),
    ...Object.fromEntries(Object.entries(action ?? {}).map(([name, value]) => [`action.${slotId}.${name}`, value])),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.GET.mockReset();
  api.PUT.mockReset();
  api.PUT.mockImplementation(async (_path, { body }) => ({ data: body, response: ok() }));
  vi.mocked(adminRequest).mockImplementation(async (call) => call(api as never));
});

describe("updateCharacterSheet", () => {
  it("saves the document as written and refreshes", async () => {
    const stored = config();

    const result = await updateCharacterSheet(null, form({ config: JSON.stringify(stored) }));

    expect(sent()).toEqual(stored);
    expect(result).toEqual({ saved: JSON.stringify(stored), deadAnchors: [], deadParams: [] });
    expect(revalidatePublic).toHaveBeenCalledWith("character-sheet");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("lists the anchors and params the home page doesn't use", async () => {
    const stored = config();
    stored.jobs[1].slots.core.action = { kind: "anchor", target: "nowhere" };
    stored.jobs[1].slots.focus.action = { kind: "param", name: "unused", value: "x", target: "projects" };

    const result = await updateCharacterSheet(null, form({ config: JSON.stringify(stored) }));

    expect(result).toMatchObject({
      deadAnchors: [expect.stringContaining("nowhere")],
      deadParams: [expect.stringContaining("unused")],
    });
  });

  it.each([
    ["{", "This isn't valid JSON:"],
    ["[]", "The config must be a JSON object."],
    ["null", "The config must be a JSON object."],
  ])("refuses %s before the backend", async (text, message) => {
    const result = await updateCharacterSheet(null, form({ config: text }));

    expect(result).toEqual({ error: expect.stringContaining(message) });
    expect(adminRequest).not.toHaveBeenCalled();
  });

  it("lists parse problems without what the lenient read would do", async () => {
    const stored = config();
    stored.defaultJobId = "missing";

    const result = await updateCharacterSheet(null, form({ config: JSON.stringify(stored) }));

    // The package's wording, minus ', using "healthcare"'. An upgrade that
    // rewords it fails here; update the text, not the check.
    expect(result).toEqual({
      error: "Not saved. Fix these problems first:",
      problems: ['defaultJobId: no valid job "missing"'],
    });
    expect(api.PUT).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refuses keys the schema doesn't have", async () => {
    const stored = config();
    stored.jobs[1].subtitel = "typo";

    const result = await updateCharacterSheet(null, form({ config: JSON.stringify(stored) }));

    expect(result).toMatchObject({
      error: expect.stringContaining("aren't in the schema"),
      problems: [expect.stringContaining("subtitel")],
    });
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a 422 by its path after config",
      422,
      { detail: [{ loc: ["body", "config", "jobs", 1, "title"], msg: "Field required", type: "missing" }] },
      { error: "The server rejected the config:", problems: ["jobs.1.title: Field required"] },
    ],
    [
      "a 422 on the whole document as (root)",
      422,
      { detail: [{ loc: ["body", "config"], msg: "Too large", type: "value_error" }] },
      { error: "The server rejected the config:", problems: ["(root): Too large"] },
    ],
    ["a string detail as it is", 413, { detail: "The config is over 256 KB." }, { error: "The config is over 256 KB." }],
    ["anything else by its status", 500, {}, { error: "Saving failed (HTTP 500)." }],
  ])("shows %s", async (_name, status, error, expected) => {
    putFails(status, error);

    const result = await updateCharacterSheet(null, form({ config: BUNDLED_JSON }));

    expect(result).toEqual(expected);
    expect(revalidatePublic).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says so when the backend can't be reached", async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce(null);

    const result = await updateCharacterSheet(null, form({ config: BUNDLED_JSON }));

    expect(result).toEqual({ error: SERVER_UNREACHABLE });
    expect(revalidatePublic).not.toHaveBeenCalled();
  });
});

// The four job actions read the saved copy first and edit it.
describe.each([
  ["updateCharacterJob", () => updateCharacterJob("ecommerce", null, jobForm(config().jobs[1]))],
  ["addCharacterJob", () => addCharacterJob(null, form({ id: "new", copy_from: "ecommerce", name: "N", title: "T" }))],
  ["setDefaultCharacterJob", () => setDefaultCharacterJob(null, form({ job_id: "ecommerce" }))],
  ["removeCharacterJob", () => removeCharacterJob("ecommerce", null, form({}))],
])("%s reading the saved copy", (_name, run) => {
  it("stops when the read fails, without saving", async () => {
    getFails(500);

    expect(await run()).toEqual({ error: "Not saved: reading the saved copy failed (HTTP 500)." });
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("stops when the backend can't be reached", async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce(null);

    expect(await run()).toEqual({ error: SERVER_UNREACHABLE });
    expect(api.PUT).not.toHaveBeenCalled();
  });
});

describe("updateCharacterJob", () => {
  it("saves an unchanged form as an unchanged document", async () => {
    const stored = config();
    saved(stored);

    const result = await updateCharacterJob("ecommerce", null, jobForm(config().jobs[1]));

    expect(sent()).toEqual(config());
    expect(result).toMatchObject({ saved: BUNDLED_JSON });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("changes only the named job", async () => {
    saved(config());

    await updateCharacterJob("ecommerce", null, jobForm(config().jobs[1], { name: "Changed" }));

    const expected = config();
    expected.jobs[1].name = "Changed";
    expect(sent()).toEqual(expected);
  });

  it("starts from a copy of the bundled file when nothing is saved yet", async () => {
    getFails(404);

    await updateCharacterJob("healthcare", null, jobForm(config().jobs[0], { title: "Changed" }));

    expect(sent().jobs[0].title).toBe("Changed");
    expect(JSON.stringify(bundledConfig)).toBe(BUNDLED_JSON);
  });

  it("asks for a reload when the job is gone", async () => {
    saved(config());

    const result = await updateCharacterJob("gone", null, jobForm(config().jobs[1]));

    expect(result).toEqual({ error: 'The saved copy has no job "gone" any more. Reload the page.' });
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("writes status only when it isn't published", async () => {
    const stored = config();
    stored.jobs[1].status = "draft";
    saved(stored);
    await updateCharacterJob("ecommerce", null, jobForm(stored.jobs[1], { status: "published" }));
    expect(sent().jobs[1]).not.toHaveProperty("status");

    api.PUT.mockClear();
    saved(config());
    await updateCharacterJob("ecommerce", null, jobForm(config().jobs[1], { status: "hidden" }));
    expect(sent().jobs[1].status).toBe("hidden");
  });

  it("removes empty optional fields", async () => {
    saved(config());

    await updateCharacterJob(
      "ecommerce",
      null,
      jobForm(config().jobs[1], { icon: "", portrait_src: "", "section.summary": "", "section.skills": " \n" }),
    );

    const job = sent().jobs[1];
    expect(job).not.toHaveProperty("icon");
    expect(job).not.toHaveProperty("portrait");
    expect(Object.keys(job.sections ?? {})).toEqual(["experience"]);
  });

  it("removes sections when every one is blank", async () => {
    const job = config().jobs[1];
    saved(config());
    const blank = Object.fromEntries(Object.keys(job.sections ?? {}).map((name) => [`section.${name}`, ""]));

    await updateCharacterJob("ecommerce", null, jobForm(job, blank));

    expect(sent().jobs[1]).not.toHaveProperty("sections");
  });

  it("stores section line endings as \\n, untrimmed", async () => {
    saved(config());

    await updateCharacterJob("ecommerce", null, jobForm(config().jobs[1], { "section.summary": "  One\r\nTwo\r\n" }));

    expect(sent().jobs[1].sections?.summary).toBe("  One\nTwo\n");
  });

  it("drops the portrait's size only when its image changes", async () => {
    const stored = config();
    stored.jobs[1].portrait = { ...stored.jobs[1].portrait!, width: 400, height: 400 };
    saved(stored);
    await updateCharacterJob("ecommerce", null, jobForm(stored.jobs[1], { portrait_alt: "New alt" }));
    expect(sent().jobs[1].portrait).toMatchObject({ alt: "New alt", width: 400, height: 400 });

    api.PUT.mockClear();
    saved(structuredClone(stored));
    await updateCharacterJob("ecommerce", null, jobForm(stored.jobs[1], { portrait_src: "https://example.com/new.png" }));
    expect(sent().jobs[1].portrait).toEqual({
      src: "https://example.com/new.png",
      alt: stored.jobs[1].portrait!.alt,
      framing: stored.jobs[1].portrait!.framing,
    });
  });

  it("edits a filled slot's tooltip and action, leaving slots not in the form alone", async () => {
    const stored = config();
    stored.jobs[1].slots.github.action = { kind: "anchor", target: "contact" };
    saved(stored);

    await updateCharacterJob(
      "ecommerce",
      null,
      jobForm(stored.jobs[1], {
        ...slotFields(
          "core",
          { title: "Next.js", subtitle: "", note: "Kept", stat_label: "", stat_value: "", tags: "" },
          { kind: "anchor", target: "#projects" },
        ),
        ...slotFields("github", { title: "GitHub" }, { kind: "link", href: "/projects" }),
      }),
    );

    const slots = sent().jobs[1].slots;
    expect(slots.core).toEqual({
      tooltip: { title: "Next.js", note: "Kept" },
      action: { kind: "anchor", target: "projects" },
    });
    // A new kind starts clean; the anchor's target doesn't linger.
    expect(slots.github.action).toEqual({ kind: "link", href: "/projects" });
    expect(slots.summary).toEqual(config().jobs[1].slots.summary);
  });

  it("keeps a slot's action when the form sends only its tooltip", async () => {
    saved(config());

    await updateCharacterJob("ecommerce", null, jobForm(config().jobs[1], slotFields("core", { title: "Next.js" })));

    expect(sent().jobs[1].slots.core.action).toEqual(config().jobs[1].slots.core.action);
  });

  it.each([
    ["with a target, without its #", "#projects", { target: "projects" }],
    ["without an empty target", "", {}],
  ])("writes a param action %s", async (_name, target, expected) => {
    saved(config());

    await updateCharacterJob(
      "ecommerce",
      null,
      jobForm(config().jobs[1], slotFields("core", { title: "React" }, { kind: "param", name: "stack", value: "react", target })),
    );

    expect(sent().jobs[1].slots.core.action).toEqual({ kind: "param", name: "stack", value: "react", ...expected });
  });

  it("drops newTab when the box is unticked, keeping the action's other keys", async () => {
    const stored = config();
    stored.jobs[1].slots.github.action = { kind: "external", href: "https://example.com", newTab: true };
    saved(stored);
    const fields = slotFields("github", { title: "GitHub" }, { kind: "external", href: "https://example.com/new" });

    await updateCharacterJob("ecommerce", null, jobForm(stored.jobs[1], fields));
    expect(sent().jobs[1].slots.github.action).toEqual({ kind: "external", href: "https://example.com/new" });

    // Ticked again, it comes back.
    api.PUT.mockClear();
    saved(structuredClone(stored));
    await updateCharacterJob("ecommerce", null, jobForm(stored.jobs[1], { ...fields, "action.github.new_tab": "on" }));
    expect(sent().jobs[1].slots.github.action).toEqual({ kind: "external", href: "https://example.com/new", newTab: true });
  });

  it("fills a slot from its fields", async () => {
    const stored = config();
    delete stored.jobs[1].slots.linkedin;
    saved(stored);

    await updateCharacterJob(
      "ecommerce",
      null,
      jobForm(stored.jobs[1], {
        fill: "linkedin",
        ...slotFields(
          "linkedin",
          {
            title: "LinkedIn",
            tags: "one, two, ,",
            stat_label: "Since",
            stat_value: "2020",
            item_label: ["", "Role", ""],
            item_value: ["Plain line", "Lead", ""],
          },
          { kind: "external", href: "https://example.com", new_tab: "on" },
        ),
      }),
    );

    expect(sent().jobs[1].slots.linkedin).toEqual({
      tooltip: {
        title: "LinkedIn",
        tags: ["one", "two"],
        stat: { label: "Since", value: "2020" },
        items: ["Plain line", { label: "Role", value: "Lead" }],
      },
      action: { kind: "external", href: "https://example.com", newTab: true },
    });
  });

  it("empties a slot", async () => {
    saved(config());

    await updateCharacterJob("ecommerce", null, jobForm(config().jobs[1], { empty: "github" }));

    const slots = sent().jobs[1].slots;
    expect(slots).not.toHaveProperty("github");
    expect(Object.keys(slots)).toHaveLength(Object.keys(config().jobs[1].slots).length - 1);
  });

  it.each([
    ["filled since the page loaded", { fill: "core" }, 'The slot "core" was filled since this page loaded. Reload the page.'],
    ["both filled and emptied", { fill: "core", empty: "core" }, `The slot "core" can't be both filled and emptied.`],
  ])("refuses a slot %s", async (_name, fields, message) => {
    saved(config());

    const result = await updateCharacterJob("ecommerce", null, jobForm(config().jobs[1], fields));

    expect(result).toEqual({ error: message });
    expect(api.PUT).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("doesn't refresh when the save is refused", async () => {
    saved(config());

    const result = await updateCharacterJob("ecommerce", null, jobForm(config().jobs[1], { title: "" }));

    expect(result).toMatchObject({ error: "Not saved. Fix these problems first:" });
    expect(api.PUT).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("addCharacterJob", () => {
  it("appends a draft copy of the named job and opens it", async () => {
    const stored = config();
    saved(stored);
    const source = structuredClone(stored.jobs[1]);

    await expect(
      addCharacterJob(null, form({ id: "data-eng", copy_from: "ecommerce", name: "Data", title: "Data engineer" })),
    ).rejects.toThrow("NEXT_REDIRECT /admin/character-sheet?job=data-eng");

    const jobs = sent().jobs;
    expect(jobs.slice(0, 2)).toEqual(config().jobs);
    expect(jobs[2]).toEqual({ ...source, id: "data-eng", name: "Data", title: "Data engineer", status: "draft" });
    expect(Object.keys(jobs[2])[0]).toBe("id");
    // A copy: editing the new job later can't change its source.
    expect(jobs[2].slots).not.toBe(jobs[1].slots);
    expect(revalidatePublic).toHaveBeenCalledWith("character-sheet");
  });

  it.each([
    ["an id already taken", { id: "healthcare", copy_from: "ecommerce" }, 'A job with the id "healthcare" already exists.'],
    ["a source that's gone", { id: "new", copy_from: "gone" }, 'The saved copy has no job "gone" any more. Reload the page.'],
  ])("refuses %s", async (_name, fields, message) => {
    saved(config());

    const result = await addCharacterJob(null, form({ ...fields, name: "N", title: "T" }));

    expect(result).toEqual({ error: message });
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("stays on the page when the save is refused", async () => {
    saved(config());

    const result = await addCharacterJob(null, form({ id: "Bad Id", copy_from: "ecommerce", name: "N", title: "T" }));

    expect(result).toMatchObject({ problems: [expect.stringMatching(/^jobs\.2\.id: /)] });
    expect(api.PUT).not.toHaveBeenCalled();
  });
});

describe("setDefaultCharacterJob", () => {
  it("changes only defaultJobId and refreshes", async () => {
    saved(config());

    const result = await setDefaultCharacterJob(null, form({ job_id: "ecommerce" }));

    expect(sent()).toEqual({ ...config(), defaultJobId: "ecommerce" });
    expect(result).toMatchObject({ saved: expect.any(String) });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses a job that's gone", async () => {
    saved(config());

    const result = await setDefaultCharacterJob(null, form({ job_id: "gone" }));

    expect(result).toEqual({ error: 'The saved copy has no job "gone" any more. Reload the page.' });
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("doesn't refresh when the save is refused", async () => {
    const stored = config();
    stored.jobs[1].status = "draft";
    saved(stored);

    const result = await setDefaultCharacterJob(null, form({ job_id: "ecommerce" }));

    expect(result).toMatchObject({ error: "Not saved. Fix these problems first:" });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("removeCharacterJob", () => {
  it("removes only the named job and says so", async () => {
    saved(config());

    await expect(removeCharacterJob("ecommerce", null, form({}))).rejects.toThrow(
      "NEXT_REDIRECT /admin/character-sheet?removed=ecommerce",
    );

    expect(sent()).toEqual({ ...config(), jobs: [config().jobs[0]] });
    expect(revalidatePublic).toHaveBeenCalledWith("character-sheet");
  });

  it("counts a job already gone as removed, without saving", async () => {
    saved(config());

    await expect(removeCharacterJob("gone", null, form({}))).rejects.toThrow(
      "NEXT_REDIRECT /admin/character-sheet?removed=gone",
    );
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("refuses the default job", async () => {
    saved(config());

    const result = await removeCharacterJob("healthcare", null, form({}));

    expect(result).toEqual({ error: expect.stringContaining('"healthcare" is the default job') });
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("keeps entries that aren't jobs, for the save to name", async () => {
    const stored = config() as JsonObject & { jobs: unknown[] };
    stored.jobs.push("junk");
    saved(stored as Config);

    const result = await removeCharacterJob("ecommerce", null, form({}));

    expect(result).toMatchObject({ problems: [expect.stringMatching(/^jobs\.1: /)] });
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("stays on the page when the backend rejects the save", async () => {
    saved(config());
    putFails(500, {});

    const result = await removeCharacterJob("ecommerce", null, form({}));

    expect(result).toEqual({ error: "Saving failed (HTTP 500)." });
  });
});
