import type { CharacterSheetConfig, Job, SlotAction } from "@alexle08/eorzean-character-sheet";
import { describe, expect, it } from "vitest";
import {
  filterByStack,
  findDeadAnchors,
  findDeadParams,
  homeAnchorTargets,
  readStackParam,
  stackParamActive,
  stackTags,
} from "./character-anchors";
import type { ProjectSummary } from "./projects";

function project(slug: string, stack: string[]): ProjectSummary {
  return { slug, stack } as ProjectSummary;
}

const projects = [
  project("api", ["FastAPI", "Python"]),
  project("site", ["React", "Next.js"]),
  project("tool", [" react ", "Node"]),
];

function job(name: string, actions: Record<string, SlotAction>, sections?: Record<string, string>): Job {
  const slots = Object.fromEntries(
    Object.entries(actions).map(([id, action]) => [id, { tooltip: { title: id }, action }]),
  );
  return { id: name.toLowerCase(), name, title: name, status: "draft", level: { label: "Lv.", value: "1" }, slots, sections };
}

function config(...jobs: Job[]): CharacterSheetConfig {
  return {
    defaultJobId: jobs[0].id,
    slots: [
      { id: "about", label: "About", position: "left" },
      { id: "skills", label: "Skills", position: "right" },
    ],
    jobs,
  };
}

describe("readStackParam", () => {
  it("trims the value", () => {
    expect(readStackParam(" React ")).toBe("React");
  });

  it("uses the first of a repeated parameter", () => {
    expect(readStackParam(["react", "python"])).toBe("react");
  });

  it("returns null for no filter", () => {
    expect(readStackParam(undefined)).toBeNull();
    expect(readStackParam("")).toBeNull();
    expect(readStackParam("   ")).toBeNull();
  });
});

describe("stackParamActive", () => {
  it("marks the stack value the page filters by, matched like the filter", () => {
    const active = stackParamActive(" react ");
    expect(active("stack", "React")).toBe(true);
    expect(active("stack", " REACT ")).toBe(true);
    expect(active("stack", "Python")).toBe(false);
  });

  it("uses the first of a repeated parameter", () => {
    expect(stackParamActive(["react", "python"])("stack", "Python")).toBe(false);
    expect(stackParamActive(["react", "python"])("stack", "React")).toBe(true);
  });

  it("ignores other parameter names", () => {
    expect(stackParamActive("react")("tag", "React")).toBe(false);
  });

  it("marks nothing without a filter", () => {
    expect(stackParamActive(undefined)("stack", "React")).toBe(false);
    expect(stackParamActive("  ")("stack", "")).toBe(false);
    expect(stackParamActive("  ")("stack", "  ")).toBe(false);
  });
});

describe("filterByStack", () => {
  it("returns null without a filter, so callers can tell it from no matches", () => {
    expect(filterByStack(projects, undefined)).toBeNull();
    expect(filterByStack(projects, " ")).toBeNull();
  });

  it("matches a whole tag, ignoring case and spaces, in the projects' spelling", () => {
    expect(filterByStack(projects, "react")).toEqual({ projects: [projects[1], projects[2]], tag: "React" });
  });

  it("doesn't match part of a tag", () => {
    expect(filterByStack(projects, "Next")).toEqual({ projects: [], tag: null });
  });

  it("returns an empty list and no tag when nothing matches", () => {
    expect(filterByStack(projects, "zzz")).toEqual({ projects: [], tag: null });
  });
});

describe("stackTags", () => {
  it("sorts ignoring case and drops duplicates", () => {
    expect(stackTags([...projects, project("more", ["Python", "astro"])])).toEqual([
      " react ",
      "astro",
      "FastAPI",
      "Next.js",
      "Node",
      "Python",
      "React",
    ]);
  });

  it("keeps tags that differ only in case in the order they first appear", () => {
    expect(stackTags([project("a", ["React"]), project("b", ["react"])])).toEqual(["React", "react"]);
  });
});

describe("homeAnchorTargets", () => {
  it("lists the job's sections in slot order, then the project list", () => {
    const c = config(job("Web", {}, { skills: "x", about: "y" }));
    expect(homeAnchorTargets(c, c.jobs[0])).toEqual(["about", "skills", "projects"]);
  });

  it("ignores an empty section", () => {
    const c = config(job("Web", {}, { about: "" }));
    expect(homeAnchorTargets(c, c.jobs[0])).toEqual(["projects"]);
  });
});

describe("findDeadAnchors", () => {
  it("accepts anchors to the job's sections and the project list", () => {
    const c = config(
      job(
        "Web",
        { about: { kind: "anchor", target: "about" }, skills: { kind: "param", name: "stack", value: "React", target: "projects" } },
        { about: "x" },
      ),
    );
    expect(findDeadAnchors(c)).toEqual([]);
  });

  it("reports anchor and param targets the job doesn't render", () => {
    const c = config(
      job("Web", { about: { kind: "anchor", target: "skills" }, skills: { kind: "param", name: "stack", value: "React", target: "about" } }),
    );
    expect(findDeadAnchors(c)).toEqual([
      "Web, About: #skills isn't a section this job shows",
      "Web, Skills: #about isn't a section this job shows",
    ]);
  });

  it("checks each job against its own sections", () => {
    const c = config(
      job("Web", { about: { kind: "anchor", target: "about" } }, { about: "x" }),
      job("Data", { about: { kind: "anchor", target: "about" } }),
    );
    expect(findDeadAnchors(c)).toEqual(["Data, About: #about isn't a section this job shows"]);
  });

  it("ignores other kinds and param actions without a target", () => {
    const c = config(
      job("Web", { about: { kind: "link", href: "/x" }, skills: { kind: "param", name: "stack", value: "React" } }),
    );
    expect(findDeadAnchors(c)).toEqual([]);
  });
});

describe("findDeadParams", () => {
  it("accepts the stack parameter", () => {
    const c = config(job("Web", { about: { kind: "param", name: "stack", value: "React" } }));
    expect(findDeadParams(c)).toEqual([]);
  });

  it("reports names the home page doesn't read, in every job", () => {
    const c = config(
      job("Web", { about: { kind: "param", name: "tag", value: "React" } }),
      job("Data", { skills: { kind: "param", name: "stacks", value: "Python" }, about: { kind: "anchor", target: "x" } }),
    );
    expect(findDeadParams(c)).toEqual([
      "Web, About: ?tag= isn't read by the home page",
      "Data, Skills: ?stacks= isn't read by the home page",
    ]);
  });
});
