import type { CharacterSheetConfig, Job, SlotAction } from "./types";

// The config as visitors see it: only published jobs, so drafts and hidden
// jobs are left out of the job menu and a ?job= link to one falls back to
// the default like an unknown id, without saying the job exists.
// parseConfig() guarantees the default job is published. Editors use the
// whole config instead.
export function publicConfig(config: CharacterSheetConfig): CharacterSheetConfig {
  return { ...config, jobs: config.jobs.filter((job) => job.status === "published") };
}

// The job named in the URL, or the default one. An unknown or repeated
// ?job= value falls back instead of failing, so an old shared link still
// opens the page.
export function resolveJob(config: CharacterSheetConfig, param: string | string[] | undefined): Job {
  const wanted = Array.isArray(param) ? param[0] : param;
  return (
    config.jobs.find((job) => job.id === wanted) ??
    config.jobs.find((job) => job.id === config.defaultJobId) ??
    config.jobs[0]
  );
}

// href with query parameters changed: each one set (replacing every copy
// of it with one, in the first one's place), or removed when its value is
// null (or undefined, for plain-JS callers); the parameters href already
// has are kept, in order. The
// result's hash is `hash` (without the #), or none: href's own hash is
// dropped, since it belonged to the page before. An empty query leaves no
// "?". The query href already has is re-encoded by URLSearchParams (a
// space becomes "+"). jobHref and param actions are built on it; a host
// can use it for its own links to the same pages.
export function withQuery(href: string, params: Record<string, string | null>, hash?: string): string {
  const withoutHash = href.split("#")[0];
  const queryAt = withoutHash.indexOf("?");
  const path = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const query = new URLSearchParams(queryAt === -1 ? "" : withoutHash.slice(queryAt + 1));
  for (const [name, value] of Object.entries(params)) {
    if (value == null) query.delete(name);
    else query.set(name, value);
  }
  const search = query.toString();
  return `${path}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

// The default job gets the bare path, so the page has one canonical URL. A
// query basePath already has is kept (its hash isn't).
export function jobHref(config: CharacterSheetConfig, jobId: string, basePath = "/", param = "job"): string {
  return withQuery(basePath, { [param]: jobId === config.defaultJobId ? null : jobId });
}

// currentHref is the page the panel is on, with its ?job= (from jobHref);
// only a param action uses it, setting its one parameter on that URL. The
// query currentHref already has is kept; from CharacterSheet that's only
// ?job=, so another parameter in the browser's URL is replaced, not added to.
export function actionHref(action: SlotAction, currentHref = "/"): string | null {
  switch (action.kind) {
    case "anchor":
      return `#${action.target}`;
    case "link":
    case "external":
      return action.href;
    case "param":
      return withQuery(currentHref, { [action.name]: action.value }, action.target);
    case "none":
      return null;
  }
}
