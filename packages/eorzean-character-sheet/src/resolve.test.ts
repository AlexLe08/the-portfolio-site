import { describe, expect, it } from "vitest";
import { actionHref, jobHref, publicConfig, resolveJob, withQuery } from "./resolve";
import type { CharacterSheetConfig, Job } from "./types";

function job(id: string, status: Job["status"] = "published"): Job {
  return { id, name: id, title: id, status, level: { label: "Lv.", value: "1" }, slots: {} };
}

const config: CharacterSheetConfig = {
  defaultJobId: "web",
  slots: [{ id: "skills", label: "Skills", position: "left" }],
  jobs: [job("web"), job("data"), job("next", "draft"), job("old", "hidden")],
};

describe("publicConfig", () => {
  it("keeps only published jobs", () => {
    expect(publicConfig(config).jobs.map((j) => j.id)).toEqual(["web", "data"]);
  });

  it("leaves the rest of the config alone", () => {
    expect(publicConfig(config).slots).toBe(config.slots);
    expect(publicConfig(config).defaultJobId).toBe("web");
  });
});

describe("resolveJob", () => {
  it("returns the job named in the URL", () => {
    expect(resolveJob(config, "data").id).toBe("data");
  });

  it("falls back to the default job for a missing or unknown id", () => {
    expect(resolveJob(config, undefined).id).toBe("web");
    expect(resolveJob(config, "nope").id).toBe("web");
  });

  it("uses the first value of a repeated parameter", () => {
    expect(resolveJob(config, ["data", "web"]).id).toBe("data");
  });

  it("falls back to the first job when the default is missing", () => {
    expect(resolveJob({ ...config, defaultJobId: "gone" }, "nope").id).toBe("web");
  });
});

describe("jobHref", () => {
  it("gives the default job the bare path", () => {
    expect(jobHref(config, "web")).toBe("/");
    expect(jobHref(config, "web", "/admin/preview")).toBe("/admin/preview");
  });

  it("names any other job in the query", () => {
    expect(jobHref(config, "data")).toBe("/?job=data");
    expect(jobHref(config, "data", "/admin/preview", "j")).toBe("/admin/preview?j=data");
  });

  it("adds to a query the base path already has", () => {
    expect(jobHref(config, "data", "/lab?theme=game")).toBe("/lab?theme=game&job=data");
    expect(jobHref(config, "web", "/lab?theme=game")).toBe("/lab?theme=game");
  });

  it("replaces a job already in the base path, and drops it for the default", () => {
    expect(jobHref(config, "data", "/?job=old")).toBe("/?job=data");
    expect(jobHref(config, "web", "/?job=old")).toBe("/");
  });
});

describe("withQuery", () => {
  it("sets parameters on a path without a query", () => {
    expect(withQuery("/", { stack: "React" })).toBe("/?stack=React");
    expect(withQuery("/lab", { a: "1", b: "2" })).toBe("/lab?a=1&b=2");
  });

  it("keeps the parameters already there, in order, and replaces one in place", () => {
    expect(withQuery("/?job=data&stack=Go", { stack: "React", page: "2" })).toBe("/?job=data&stack=React&page=2");
  });

  it("removes a parameter set to null, and the ? with the last one", () => {
    expect(withQuery("/?job=data&stack=Go", { stack: null })).toBe("/?job=data");
    expect(withQuery("/?stack=Go", { stack: null })).toBe("/");
    expect(withQuery("/lab", { stack: null })).toBe("/lab");
  });

  it("drops the href's hash and adds the one given", () => {
    expect(withQuery("/?job=data#about", {})).toBe("/?job=data");
    expect(withQuery("/#about", { stack: "Go" }, "projects")).toBe("/?stack=Go#projects");
    expect(withQuery("/", {}, "projects")).toBe("/#projects");
  });

  it("encodes values", () => {
    expect(withQuery("/", { stack: "C# & .NET" })).toBe("/?stack=C%23+%26+.NET");
  });

  it("leaves a relative or empty path as it is", () => {
    expect(withQuery("admin?x=1", { y: "2" })).toBe("admin?x=1&y=2");
    expect(withQuery("", { y: "2" })).toBe("?y=2");
  });
});

describe("actionHref", () => {
  it("links an anchor to its id on the same page", () => {
    expect(actionHref({ kind: "anchor", target: "projects" })).toBe("#projects");
  });

  it("passes link and external hrefs through", () => {
    expect(actionHref({ kind: "link", href: "/projects/a" })).toBe("/projects/a");
    expect(actionHref({ kind: "external", href: "https://example.com" })).toBe("https://example.com");
  });

  it("returns null for no action", () => {
    expect(actionHref({ kind: "none" })).toBeNull();
  });

  describe("param", () => {
    const stack = { kind: "param", name: "stack", value: "React" } as const;

    it("sets the parameter on the current page", () => {
      expect(actionHref(stack)).toBe("/?stack=React");
      expect(actionHref(stack, "/admin/preview")).toBe("/admin/preview?stack=React");
    });

    it("keeps the query the current href already has", () => {
      expect(actionHref(stack, "/?job=data")).toBe("/?job=data&stack=React");
    });

    it("replaces the parameter's old value instead of repeating it", () => {
      expect(actionHref(stack, "/?stack=Python&job=data")).toBe("/?stack=React&job=data");
    });

    it("drops the current hash and adds the target's", () => {
      expect(actionHref(stack, "/?job=data#about")).toBe("/?job=data&stack=React");
      expect(actionHref({ ...stack, target: "projects" }, "/#about")).toBe("/?stack=React#projects");
    });

    it("encodes the value", () => {
      expect(actionHref({ ...stack, value: "C# & .NET" })).toBe("/?stack=C%23+%26+.NET");
    });
  });
});
