"use client";

import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import { CharacterSheetSaveStatus } from "@/components/CharacterSheetSaveStatus";
import { useSaveAction } from "@/lib/use-save-action";

type Props = {
  // addCharacterJob, which goes to the new job's form once it's saved.
  action: (state: CharacterSheetFormState, formData: FormData) => Promise<CharacterSheetFormState>;
  // The jobs a new one can start from, in menu order.
  jobs: { id: string; name: string }[];
  // The job being edited, preselected as the one to copy.
  currentJobId: string;
  // From the zod schema (see JobFieldLimits); the pattern is ID_PATTERN.
  limits: { id: number | null; name: number | null; title: number | null };
  idPattern: string;
};

// A new job starts as a copy of an existing one, since jobs share most
// slots (contact, links, projects). Folded away: it's needed rarely.
export function CharacterJobAddForm({ action, jobs, currentJobId, limits, idPattern }: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);
  const max = (limit: number | null) => limit ?? undefined;

  return (
    <details className="form-more">
      <summary>Add a job</summary>
      <form onSubmit={onSubmit} className="form-group">
        <div className="form-field">
          <label htmlFor="new-job-id" className="form-label">
            Id
          </label>
          <input
            id="new-job-id"
            name="id"
            required
            maxLength={max(limits.id)}
            pattern={idPattern}
            aria-describedby="new-job-id-help"
            className="form-input"
          />
          <p id="new-job-id-help" className="form-help">
            In the page address (?job=), so it can&rsquo;t change later from this form. Lowercase
            letters, digits, and hyphens, for example: ai-development
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="new-job-name" className="form-label">
            Name
          </label>
          <input
            id="new-job-name"
            name="name"
            required
            maxLength={max(limits.name)}
            aria-describedby="new-job-name-help"
            className="form-input"
          />
          <p id="new-job-name-help" className="form-help">
            In the job menu, for example: AI development
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="new-job-title" className="form-label">
            Title
          </label>
          <input
            id="new-job-title"
            name="title"
            required
            maxLength={max(limits.title)}
            aria-describedby="new-job-title-help"
            className="form-input"
          />
          <p id="new-job-title-help" className="form-help">
            The panel heading, for example: Developer in AI
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="new-job-copy-from" className="form-label">
            Start from
          </label>
          <select
            id="new-job-copy-from"
            name="copy_from"
            defaultValue={currentJobId}
            aria-describedby="new-job-copy-from-help"
            className="form-input form-input--fit"
          >
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </select>
          <p id="new-job-copy-from-help" className="form-help">
            Copies its level, portrait, slots, and sections. The job shows on the home page as soon
            as it&rsquo;s added, so edit what differs straight after.
          </p>
        </div>

        <CharacterSheetSaveStatus state={state} pending={pending} unknownKeys={[]} />

        <div className="form-actions">
          <button type="submit" className="form-button" disabled={pending}>
            {pending ? "Adding…" : "Add job"}
          </button>
        </div>
      </form>
    </details>
  );
}
