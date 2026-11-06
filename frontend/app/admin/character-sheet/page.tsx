import Link from "next/link";
import { addCharacterJob, removeCharacterJob, updateCharacterJob } from "./actions";
import { jobHref, resolveJob } from "@/components/character-sheet/resolve";
import {
  ID_PATTERN,
  jobSchema,
  pairSchema,
  portraitSchema,
  slotActionSchema,
  TOOLTIP_MAX_ITEMS,
  TOOLTIP_MAX_TAGS,
  tooltipSchema,
} from "@/components/character-sheet/schema";
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

export const metadata = {
  title: "Character sheet",
};

const BASE_PATH = "/admin/character-sheet";

// From the zod schema, so the form's limits can't drift from the checks.
const jobFields = jobSchema.shape;
const portraitFields = portraitSchema.shape;
const LIMITS: JobFieldLimits = {
  name: jobFields.name.maxLength,
  title: jobFields.title.maxLength,
  icon: jobFields.icon.unwrap().maxLength,
  levelLabel: jobFields.level.shape.label.maxLength,
  levelValue: jobFields.level.shape.value.maxLength,
  portraitSrc: portraitFields.src.maxLength,
  portraitAlt: portraitFields.alt.maxLength,
  section: jobFields.sections.unwrap().valueType.maxLength,
};
const tooltipFields = tooltipSchema.shape;
const [lineItem] = tooltipFields.items.unwrap().element.options;
const TOOLTIP_LIMITS: TooltipFieldLimits = {
  title: tooltipFields.title.maxLength,
  tag: tooltipFields.tags.unwrap().element.maxLength,
  subtitle: tooltipFields.subtitle.unwrap().maxLength,
  statLabel: pairSchema.shape.label.maxLength,
  statValue: pairSchema.shape.value.maxLength,
  itemLabel: pairSchema.shape.label.maxLength,
  // One input holds a plain line's text or a pair's value: the tighter limit.
  itemValue: Math.min(lineItem.maxLength ?? Infinity, pairSchema.shape.value.maxLength ?? Infinity),
  note: tooltipFields.note.unwrap().maxLength,
  maxTags: TOOLTIP_MAX_TAGS,
  maxItems: TOOLTIP_MAX_ITEMS,
};
const [anchorAction, linkAction, externalAction] = slotActionSchema.options;
const ACTION_LIMITS: SlotActionLimits = {
  target: anchorAction.shape.target.maxLength,
  // One input holds a link's path or an external URL: the tighter limit.
  href: Math.min(linkAction.shape.href.maxLength ?? Infinity, externalAction.shape.href.maxLength ?? Infinity),
};

// One job at a time, picked with ?job= like the home page. The rest of the
// config (slot definitions, which job is the default) is edited as JSON.
// ?removed= is where removeCharacterJob lands, on the default job's form.
export default async function AdminCharacterSheetPage({
  searchParams,
}: PageProps<"/admin/character-sheet">) {
  const [{ parsed, bundled, stored, unknownKeys }, { job: jobParam, removed }, uploads] = await Promise.all([
    loadCharacterSheetForAdmin(),
    searchParams,
    loadUploads(),
  ]);
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
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {jsonLink}
      </div>
      <p className="form-help admin-intro">
        The slots themselves (names, icons, order) and which job is the default are edited as JSON.
      </p>
      <CharacterJobAddForm
        action={addCharacterJob}
        jobs={config.jobs.map(({ id, name }) => ({ id, name }))}
        currentJobId={job.id}
        limits={{ id: jobFields.id.maxLength, name: LIMITS.name, title: LIMITS.title }}
        idPattern={ID_PATTERN.source}
      />

      {/* Keyed by job: the inputs are uncontrolled, so switching jobs has to
          remount them to show the new job's values. */}
      <CharacterJobForm
        key={job.id}
        action={updateCharacterJob.bind(null, job.id)}
        job={job}
        slots={config.slots.map(({ id, label }) => ({ id, label }))}
        limits={LIMITS}
        tooltipLimits={TOOLTIP_LIMITS}
        actionLimits={ACTION_LIMITS}
        // The ids app/page.tsx renders for this job: its sections, in
        // slot order, then the project list.
        anchorTargets={[
          ...config.slots.filter((slot) => job.sections?.[slot.id]).map((slot) => slot.id),
          "projects",
        ]}
        uploads={uploads}
        bundled={bundled}
        stored={stored}
        unknownKeys={unknownKeys}
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
