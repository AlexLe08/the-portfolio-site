import Link from "next/link";
import { jobHref, resolveJob, type JobStatus } from "@solution-nine/wol-character-panel";
import { AutoRetry } from "@/components/AutoRetry";
import { HomeView } from "@/components/HomeView";
import { Sheet } from "@/components/Sheet";
import { StatusMessage } from "@/components/StatusMessage";
import { adminLoad } from "@/lib/admin-api";
import { loadCharacterSheetForAdmin } from "@/lib/character-admin";
import { FALLBACK_CONTENT } from "@/lib/content";
import { loadProjects } from "@/lib/projects";

export const metadata = {
  title: "Character sheet preview",
};

const BASE_PATH = "/admin/character-sheet/preview";
const EDITOR_PATH = "/admin/character-sheet";

const STATUS_NOTE: Record<JobStatus, string> = {
  published: "Visitors see this job.",
  draft: "Visitors don't see this job yet: it's a draft.",
  hidden: "Visitors don't see this job: it's hidden.",
};

// The home page as it would look with every job published: drafts and
// hidden jobs are in the job menu and open with ?job=, like on the home
// page. Read straight from the backend like the editors (no fallbacks), so
// what shows is what's saved.
export default async function CharacterSheetPreviewPage({
  searchParams,
}: PageProps<"/admin/character-sheet/preview">) {
  // The admin loads check the session first (adminApi()). The project list
  // is public, so it starts alongside them rather than after.
  const [{ parsed }, stored, projects, { job: jobParam, stack }] = await Promise.all([
    loadCharacterSheetForAdmin(),
    adminLoad("content", (api) => api.GET("/content")),
    loadProjects(),
    searchParams,
  ]);

  if (!parsed.config) {
    return (
      <Sheet title="Character sheet preview" back={{ href: EDITOR_PATH, label: "Character sheet" }}>
        <StatusMessage tone="error">
          The saved copy has problems, so there&rsquo;s nothing to preview. The editor lists them.
        </StatusMessage>
      </Sheet>
    );
  }

  const config = parsed.config;
  const job = resolveJob(config, jobParam);
  // Unset keys show their built-in text, as on the home page. Unknown
  // stored keys come along too, but nothing reads them.
  const content = { ...FALLBACK_CONTENT, ...stored };

  return (
    <AutoRetry active={projects === null}>
      <HomeView
        config={config}
        job={job}
        content={content}
        projects={projects}
        basePath={BASE_PATH}
        stack={stack}
        notice={
          <StatusMessage tone="info">
            {`Preview of ${job.name}. ${STATUS_NOTE[job.status]} `}
            <Link href={jobHref(config, job.id, EDITOR_PATH)}>Edit this job</Link>
          </StatusMessage>
        }
      />
    </AutoRetry>
  );
}
