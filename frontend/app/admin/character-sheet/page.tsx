import Link from "next/link";
import { updateCharacterJob } from "./actions";
import { jobHref, resolveJob } from "@/components/character-sheet/resolve";
import { jobSchema, portraitSchema } from "@/components/character-sheet/schema";
import { CharacterJobForm, type JobFieldLimits } from "@/components/CharacterJobForm";
import { Sheet } from "@/components/Sheet";
import { StatusMessage } from "@/components/StatusMessage";
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

// One job at a time, picked with ?job= like the home page. The rest of the
// config (slots, tooltips, actions, adding jobs) is edited as JSON.
export default async function AdminCharacterSheetPage({
  searchParams,
}: PageProps<"/admin/character-sheet">) {
  const [{ parsed, bundled, stored, unknownKeys }, { job: jobParam }] = await Promise.all([
    loadCharacterSheetForAdmin(),
    searchParams,
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
  return (
    <Sheet title="Character sheet" back={{ href: "/admin", label: "Admin" }}>
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
        Slots, tooltips, links, and adding or removing jobs are edited as JSON.
      </p>

      {/* Keyed by job: the inputs are uncontrolled, so switching jobs has to
          remount them to show the new job's values. */}
      <CharacterJobForm
        key={job.id}
        action={updateCharacterJob.bind(null, job.id)}
        job={job}
        slots={config.slots.map(({ id, label }) => ({ id, label }))}
        limits={LIMITS}
        bundled={bundled}
        stored={stored}
        unknownKeys={unknownKeys}
      />
    </Sheet>
  );
}
