"use client";

import type { ProjectFormState } from "@/app/admin/projects/actions";
import { SaveStatus } from "@/components/SaveStatus";
import type { components } from "@/lib/api-types";
import { MAX_LENGTH, SLUG_PATTERN } from "@/lib/project-rules";
import { useSaveAction } from "@/lib/use-save-action";

type Project = components["schemas"]["ProjectAdmin"];

type Props = {
  // createProject, or updateProject bound to a slug.
  action: (state: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  // Absent when creating. The slug field only appears then, because the
  // slug is the project's URL and can't change afterwards.
  project?: Project;
};

export function ProjectForm({ action, project }: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);

  return (
    <form onSubmit={onSubmit}>
      {!project && (
        <div className="form-field">
          <label htmlFor="slug" className="form-label">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            required
            pattern={SLUG_PATTERN}
            maxLength={MAX_LENGTH.slug}
            aria-describedby="slug-help"
            className="form-input"
          />
          <p id="slug-help" className="form-help">
            The project&rsquo;s URL, as in /projects/your-slug. Lowercase letters, numbers and
            hyphens. It can&rsquo;t be changed later.
          </p>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="title" className="form-label">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={MAX_LENGTH.title}
          defaultValue={project?.title}
          className="form-input"
        />
      </div>

      <div className="form-field">
        <label htmlFor="summary" className="form-label">
          Summary
        </label>
        <textarea
          id="summary"
          name="summary"
          required
          rows={3}
          defaultValue={project?.summary}
          className="form-input form-textarea"
        />
      </div>

      <div className="form-field">
        <label htmlFor="stack" className="form-label">
          Stack
        </label>
        <input
          id="stack"
          name="stack"
          aria-describedby="stack-help"
          defaultValue={project?.stack.join(", ")}
          className="form-input"
        />
        <p id="stack-help" className="form-help">
          Separate items with commas, for example: Python, FastAPI
        </p>
      </div>

      <div className="form-field">
        <label htmlFor="repo_url" className="form-label">
          Repository URL
        </label>
        <input
          id="repo_url"
          name="repo_url"
          type="url"
          maxLength={MAX_LENGTH.repo_url}
          aria-describedby="repo-help"
          defaultValue={project?.repo_url ?? ""}
          className="form-input"
        />
        <p id="repo-help" className="form-help">
          Optional. Leave empty for a private repository.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor="sort_order" className="form-label">
          Order
        </label>
        <input
          id="sort_order"
          name="sort_order"
          type="number"
          step={1}
          required
          aria-describedby="order-help"
          defaultValue={project?.sort_order ?? 0}
          className="form-input form-input--short"
        />
        <p id="order-help" className="form-help">
          Lowest first. Steps of 10 leave room to slot a project in between.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor="case_study_md" className="form-label">
          Case study (markdown)
        </label>
        <textarea
          id="case_study_md"
          name="case_study_md"
          required
          rows={24}
          defaultValue={project?.case_study_md}
          className="form-input form-textarea"
        />
      </div>

      <div className="form-check">
        <input
          id="published"
          name="published"
          type="checkbox"
          defaultChecked={project?.published ?? false}
        />
        <label htmlFor="published">Published (shown on the site)</label>
      </div>

      <SaveStatus state={state} pending={pending} />

      <div className="form-actions">
        <button type="submit" className="form-button" disabled={pending}>
          {pending ? "Saving…" : project ? "Save changes" : "Create project"}
        </button>
      </div>
    </form>
  );
}
