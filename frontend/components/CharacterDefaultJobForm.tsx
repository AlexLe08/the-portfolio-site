"use client";

import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import { CharacterSheetSaveStatus } from "@/components/CharacterSheetSaveStatus";
import { useSaveAction } from "@/lib/use-save-action";

type Props = {
  // setDefaultCharacterJob, which re-renders the page once it's saved.
  action: (state: CharacterSheetFormState, formData: FormData) => Promise<CharacterSheetFormState>;
  // The published jobs, in menu order: drafts and hidden jobs can't be
  // the default.
  jobs: { id: string; name: string }[];
  defaultJobId: string;
};

// Which job / shows with no ?job=. A setting of the whole config, so one
// form for the page rather than one per job. Folded away like "Add a job",
// with the current default in the summary so it shows while folded.
export function CharacterDefaultJobForm({ action, jobs, defaultJobId }: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);
  const current = jobs.find((job) => job.id === defaultJobId);

  return (
    <details className="form-more">
      <summary>Default job: {current?.name ?? defaultJobId}</summary>
      <form onSubmit={onSubmit} className="form-group">
        <div className="form-field">
          <label htmlFor="default-job" className="form-label">
            Default job
          </label>
          <select
            id="default-job"
            name="job_id"
            defaultValue={defaultJobId}
            aria-describedby="default-job-help"
            className="form-input form-input--fit"
          >
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </select>
          <p id="default-job-help" className="form-help">
            The job the home page shows at / with no ?job=. Only published jobs are listed. The
            default job can&rsquo;t be removed or taken off the site, so pick another one here
            first.
          </p>
        </div>

        <CharacterSheetSaveStatus state={state} pending={pending} unknownKeys={[]} deadAnchors={[]} />

        <div className="form-actions">
          <button type="submit" className="form-button" disabled={pending}>
            {pending ? "Saving…" : "Save default"}
          </button>
        </div>
      </form>
    </details>
  );
}
