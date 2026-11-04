import type { CharacterSheetConfig, Job, SlotAction } from "./types";

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

// The default job gets the bare path, so the page has one canonical URL.
export function jobHref(config: CharacterSheetConfig, jobId: string, basePath = "/", param = "job"): string {
  if (jobId === config.defaultJobId) return basePath;
  return `${basePath}?${new URLSearchParams({ [param]: jobId })}`;
}

export function actionHref(action: SlotAction): string | null {
  switch (action.kind) {
    case "anchor":
      return `#${action.target}`;
    case "link":
    case "external":
      return action.href;
    case "none":
      return null;
  }
}
