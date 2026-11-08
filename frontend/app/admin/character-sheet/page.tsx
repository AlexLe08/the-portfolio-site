import Link from "next/link";
import { addCharacterJob, removeCharacterJob, setDefaultCharacterJob, updateCharacterJob } from "./actions";
import { ID_PATTERN, jobHref, LIMITS, PARAM_NAME_PATTERN, resolveJob } from "@solution-nine/wol-character-panel";
import { CharacterDefaultJobForm } from "@/components/CharacterDefaultJobForm";
import { CharacterJobAddForm } from "@/components/CharacterJobAddForm";
import { CharacterJobForm, type JobFieldLimits } from "@/components/CharacterJobForm";
import { CharacterJobRemoveForm } from "@/components/CharacterJobRemoveForm";
import type { PortraitUpload } from "@/components/PortraitPicker";
import type { SlotActionLimits } from "@/components/SlotActionFields";
import type { TooltipFieldLimits } from "@/components/SlotTooltipFields";
import { Sheet } from "@/components/Sheet";
import { StatusMessage } from "@/components/StatusMessage";
import { adminRequest } from "@/lib/admin-api";
import { loadCharacterSheetForAdmin } from "@/lib/character-admin";
import { homeAnchorTargets, stackTags } from "@/lib/character-anchors";

export const metadata = {
  title: "Character sheet",
};

const BASE_PATH = "/admin/character-sheet";

// From the package's LIMITS, which its zod schema is built from, so the
// form's limits can't drift from the checks.
const JOB_LIMITS: JobFieldLimits = {
  name: LIMITS.job.name,
  title: LIMITS.job.title,
  icon: LIMITS.job.icon,
  levelLabel: LIMITS.job.levelLabel,
  levelValue: LIMITS.job.levelValue,
  portraitSrc: LIMITS.portrait.src,
  portraitAlt: LIMITS.portrait.alt,
  section: LIMITS.job.section,
};
const TOOLTIP_LIMITS: TooltipFieldLimits = {
  title: LIMITS.tooltip.title,
  tag: LIMITS.tooltip.tag,
  subtitle: LIMITS.tooltip.subtitle,
  statLabel: LIMITS.pair.label,
  statValue: LIMITS.pair.value,
  itemLabel: LIMITS.pair.label,
  // One input holds a plain line's text or a pair's value: the tighter limit.
  itemValue: Math.min(LIMITS.tooltip.item, LIMITS.pair.value),
  note: LIMITS.tooltip.note,
  maxTags: LIMITS.tooltip.tags,
  maxItems: LIMITS.tooltip.items,
};
const ACTION_LIMITS: SlotActionLimits = {
  target: LIMITS.id,
  href: LIMITS.action.href,
  paramName: LIMITS.action.paramName,
  paramValue: LIMITS.action.paramValue,
};

// One job at a time, picked with ?job= like the home page, plus which job
// is the default. The slot definitions are edited as JSON.
// ?removed= is where removeCharacterJob lands, on the default job's form.
export default async function AdminCharacterSheetPage({
  searchParams,
}: PageProps<"/admin/character-sheet">) {
  const [
    { parsed, bundled, stored, unknownKeys, deadAnchors, deadParams },
    { job: jobParam, removed },
    uploads,
    tags,
  ] = await Promise.all([loadCharacterSheetForAdmin(), searchParams, loadUploads(), loadStackTags()]);
  const jsonLink = <Link href={`${BASE_PATH}/json`}>Edit as JSON</Link>;

  // Every save checks the whole document strictly, so with problems in
  // the saved copy no form save could succeed until they're fixed.
  if (!parsed.config || parsed.errors.length > 0) {
    return (
      <Sheet title="Character sheet" back={{ href: "/admin", label: "Admin" }}>
        <StatusMessage tone="error">
          The saved copy has problems the form can&rsquo;t fix. Fix them as JSON first:
          <ul className="json-editor__problems">
            {parsed.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </StatusMessage>
        <p>{jsonLink}</p>
      </Sheet>
    );
  }

  const config = parsed.config;
  const job = resolveJob(config, jobParam);
  // Only a well-formed id that really is gone, so a hand-edited or stale
  // link can't claim a removal that didn't happen.
  const removedId = typeof removed === "string" ? removed : undefined;
  const showRemoved =
    removedId !== undefined &&
    ID_PATTERN.test(removedId) &&
    !config.jobs.some((each) => each.id === removedId);
  return (
    <Sheet title="Character sheet" back={{ href: "/admin", label: "Admin" }}>
      {showRemoved && <StatusMessage tone="success">{`Removed the job "${removedId}".`}</StatusMessage>}
      <div className="admin-toolbar">
        <nav aria-label="Jobs">
          <ul className="job-picker">
            {config.jobs.map((each) => (
              <li key={each.id}>
                <Link
                  href={jobHref(config, each.id, BASE_PATH)}
                  aria-current={each.id === job.id ? "page" : undefined}
                >
                  {each.name}
                  {/* Off the home page, so said where the job is picked. */}
                  {each.status !== "published" && ` (${each.status})`}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="admin-toolbar__links">
          {/* The saved copy, so unsaved edits in the form below don't show. */}
          <Link href={jobHref(config, job.id, `${BASE_PATH}/preview`)}>Preview</Link>
          {jsonLink}
        </div>
      </div>
      <p className="form-help admin-intro">
        The slots themselves (names, icons, order) are edited as JSON.
      </p>
      <CharacterDefaultJobForm
        action={setDefaultCharacterJob}
        // Only published jobs can be the default (parseConfig).
        jobs={config.jobs.filter((each) => each.status === "published").map(({ id, name }) => ({ id, name }))}
        defaultJobId={config.defaultJobId}
      />
      <CharacterJobAddForm
        action={addCharacterJob}
        jobs={config.jobs.map(({ id, name }) => ({ id, name }))}
        currentJobId={job.id}
        limits={{ id: LIMITS.id, name: LIMITS.job.name, title: LIMITS.job.title }}
        idPattern={ID_PATTERN.source}
      />

      {/* Keyed by job: the inputs are uncontrolled, so switching jobs has to
          remount them to show the new job's values. */}
      <CharacterJobForm
        key={job.id}
        action={updateCharacterJob.bind(null, job.id)}
        job={job}
        isDefault={job.id === config.defaultJobId}
        slots={config.slots.map(({ id, label }) => ({ id, label }))}
        limits={JOB_LIMITS}
        tooltipLimits={TOOLTIP_LIMITS}
        actionLimits={ACTION_LIMITS}
        // The ids the home page renders for this job.
        anchorTargets={homeAnchorTargets(config, job)}
        paramNamePattern={PARAM_NAME_PATTERN.source}
        stackTags={tags}
        uploads={uploads}
        bundled={bundled}
        stored={stored}
        unknownKeys={unknownKeys}
        deadAnchors={deadAnchors}
        deadParams={deadParams}
      />

      {/* A separate form: nested in the job's form, it would submit it. */}
      <CharacterJobRemoveForm
        key={`remove-${job.id}`}
        action={removeCharacterJob.bind(null, job.id)}
        job={{ id: job.id, name: job.name }}
        isDefault={job.id === config.defaultJobId}
      />
    </Sheet>
  );
}

// The portrait picker's choices. Without them the form still works with a
// pasted URL, so a failed load shows a note instead of the error page.
// Only the fields the picker shows go to the browser.
async function loadUploads(): Promise<PortraitUpload[] | null> {
  const result = await adminRequest((api) => api.GET("/admin/media"));
  return (
    result?.data?.map(({ url, alt_text, width, height }) => ({ url, alt_text, width, height })) ?? null
  );
}

// Suggested values for a ?stack= param action: the tags of the projects
// the home page lists. Only suggestions, so a failed load offers none.
async function loadStackTags(): Promise<string[]> {
  const result = await adminRequest((api) => api.GET("/admin/projects"));
  return stackTags(result?.data?.filter((project) => project.published) ?? []);
}
