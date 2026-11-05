"use client";

import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import type { Job } from "@/components/character-sheet/types";
import { CharacterSheetSaveStatus, describeStoredCopy } from "@/components/CharacterSheetSaveStatus";
import { PortraitPicker, type PortraitUpload } from "@/components/PortraitPicker";
import { SlotTooltipFields, type TooltipFieldLimits } from "@/components/SlotTooltipFields";
import { useSaveAction } from "@/lib/use-save-action";

// Max lengths read from the zod schema by the page (null: no limit), so the
// numbers live only in schema.ts and zod stays out of the browser bundle.
export type JobFieldLimits = Record<
  "name" | "title" | "icon" | "levelLabel" | "levelValue" | "portraitSrc" | "portraitAlt" | "section",
  number | null
>;

type Props = {
  // updateCharacterJob bound to the job's id.
  action: (state: CharacterSheetFormState, formData: FormData) => Promise<CharacterSheetFormState>;
  job: Job;
  // In panel order: one markdown field per slot, labelled like the slot,
  // the way the home page renders a job's sections.
  slots: { id: string; label: string }[];
  limits: JobFieldLimits;
  tooltipLimits: TooltipFieldLimits;
  // For the portrait; null when loading them failed.
  uploads: PortraitUpload[] | null;
  // As in CharacterSheetEditor.
  bundled: string;
  stored: string | null;
  unknownKeys: string[];
};

// The fields of one job edited most. updateCharacterJob writes them into
// the saved copy and leaves the rest of the document alone.
export function CharacterJobForm({
  action,
  job,
  slots,
  limits,
  tooltipLimits,
  uploads,
  bundled,
  stored,
  unknownKeys,
}: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);
  const note = describeStoredCopy(state && "saved" in state ? state.saved : stored, bundled);
  const max = (limit: number | null) => limit ?? undefined;

  // Slots without a section are folded away, so the page shows what the
  // home page shows. Adding one is a click.
  const withSection = slots.filter((slot) => job.sections?.[slot.id]);
  const withoutSection = slots.filter((slot) => !job.sections?.[slot.id]);
  const sectionField = (slot: Props["slots"][number]) => (
    <div className="form-field" key={slot.id}>
      <label htmlFor={`section-${slot.id}`} className="form-label">
        {slot.label}
      </label>
      <textarea
        id={`section-${slot.id}`}
        name={`section.${slot.id}`}
        rows={6}
        maxLength={max(limits.section)}
        defaultValue={job.sections?.[slot.id] ?? ""}
        className="form-input form-textarea"
      />
    </div>
  );

  return (
    <form onSubmit={onSubmit}>
      <fieldset className="form-group">
        <legend className="admin-heading">Job</legend>
        <div className="form-field">
          <label htmlFor="name" className="form-label">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={max(limits.name)}
            defaultValue={job.name}
            aria-describedby="name-help"
            className="form-input"
          />
          <p id="name-help" className="form-help">
            In the job menu, for example: Healthcare
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="title" className="form-label">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={max(limits.title)}
            defaultValue={job.title}
            aria-describedby="title-help"
            className="form-input"
          />
          <p id="title-help" className="form-help">
            The panel heading, for example: Developer in healthcare
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="icon" className="form-label">
            Icon
          </label>
          <input
            id="icon"
            name="icon"
            maxLength={max(limits.icon)}
            defaultValue={job.icon ?? ""}
            aria-describedby="icon-help"
            className="form-input form-input--short"
          />
          <p id="icon-help" className="form-help">
            Optional. Up to {limits.icon} characters beside the title. Empty uses the name&rsquo;s
            first two letters.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="level_label" className="form-label">
            Level label
          </label>
          <input
            id="level_label"
            name="level_label"
            required
            maxLength={max(limits.levelLabel)}
            defaultValue={job.level.label}
            className="form-input"
          />
        </div>

        <div className="form-field">
          <label htmlFor="level_value" className="form-label">
            Level value
          </label>
          <input
            id="level_value"
            name="level_value"
            required
            maxLength={max(limits.levelValue)}
            defaultValue={job.level.value}
            className="form-input"
          />
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend className="admin-heading">Portrait</legend>
        <PortraitPicker
          uploads={uploads}
          src={job.portrait?.src ?? ""}
          alt={job.portrait?.alt ?? ""}
          srcMaxLength={max(limits.portraitSrc)}
          altMaxLength={max(limits.portraitAlt)}
        />

        <div className="form-field">
          <label htmlFor="portrait_framing" className="form-label">
            Framing
          </label>
          <select
            id="portrait_framing"
            name="portrait_framing"
            defaultValue={job.portrait?.framing ?? "face"}
            aria-describedby="portrait-framing-help"
            className="form-input form-input--short"
          >
            <option value="face">Face</option>
            <option value="full">Full</option>
          </select>
          <p id="portrait-framing-help" className="form-help">
            Face keeps the top of the photo in frame; full centers it.
          </p>
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend className="admin-heading">Slot tooltips</legend>
        <p className="form-help">
          Filled slots only. Filling an empty slot, and where a slot links to, are edited as JSON.
        </p>
        {/* Closed by default: open each slot you want to change. Closed
            fields still submit, so saving never drops a tooltip. */}
        {slots.map((slot) => {
          const content = job.slots[slot.id];
          if (!content) return null;
          return (
            <details key={slot.id} className="form-more">
              <summary>
                {slot.label}: {content.tooltip.title}
              </summary>
              <SlotTooltipFields slotId={slot.id} tooltip={content.tooltip} limits={tooltipLimits} />
            </details>
          );
        })}
      </fieldset>

      <fieldset className="form-group">
        <legend className="admin-heading">Page sections</legend>
        <p className="form-help">
          Markdown shown below the panel, in slot order. Empty removes the section.
        </p>
        {withSection.map(sectionField)}
        {withoutSection.length > 0 && (
          <details className="form-more">
            <summary>Slots without a section ({withoutSection.length})</summary>
            {withoutSection.map(sectionField)}
          </details>
        )}
      </fieldset>

      <CharacterSheetSaveStatus state={state} pending={pending} unknownKeys={unknownKeys} />
      {note && <p className="form-help">{note}</p>}

      <div className="form-actions">
        <button type="submit" className="form-button" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
