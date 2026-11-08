"use client";

import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import type { Job, JobStatus } from "@solution-nine/wol-character-panel";
import { CharacterSheetSaveStatus, describeStoredCopy } from "@/components/CharacterSheetSaveStatus";
import { useRef, useState } from "react";
import { PortraitPicker, type PortraitUpload } from "@/components/PortraitPicker";
import { SlotActionFields, type SlotActionLimits } from "@/components/SlotActionFields";
import { SlotTooltipFields, type TooltipFieldLimits } from "@/components/SlotTooltipFields";
import { useSaveAction } from "@/lib/use-save-action";

// Max lengths the page reads from the package's LIMITS (null: no limit), so
// the numbers live only in schema.ts and zod stays out of the browser bundle.
export type JobFieldLimits = Record<
  "name" | "title" | "icon" | "levelLabel" | "levelValue" | "portraitSrc" | "portraitAlt" | "section",
  number | null
>;

// Typed by the status, so a new one in the schema fails the build here.
const STATUS_LABELS: Record<JobStatus, string> = {
  published: "Published (on the site)",
  draft: "Draft (not on the site yet)",
  hidden: "Hidden (taken off the site)",
};

type Props = {
  // updateCharacterJob bound to the job's id.
  action: (state: CharacterSheetFormState, formData: FormData) => Promise<CharacterSheetFormState>;
  job: Job;
  // The default job has to stay published.
  isDefault: boolean;
  // In panel order: one markdown field per slot, labelled like the slot,
  // the way the home page renders a job's sections.
  slots: { id: string; label: string }[];
  limits: JobFieldLimits;
  tooltipLimits: TooltipFieldLimits;
  actionLimits: SlotActionLimits;
  // Suggested anchor targets, the param name pattern and stack tags: see
  // SlotActionFields.
  anchorTargets: string[];
  paramNamePattern: string;
  stackTags: string[];
  // For the portrait; null when loading them failed.
  uploads: PortraitUpload[] | null;
  // As in CharacterSheetEditor.
  bundled: string;
  stored: string | null;
  unknownKeys: string[];
  deadAnchors: string[];
  deadParams: string[];
};

// The fields of one job edited most. updateCharacterJob writes them into
// the saved copy and leaves the rest of the document alone.
export function CharacterJobForm({
  action,
  job,
  isDefault,
  slots,
  limits,
  tooltipLimits,
  actionLimits,
  anchorTargets,
  paramNamePattern,
  stackTags,
  uploads,
  bundled,
  stored,
  unknownKeys,
  deadAnchors,
  deadParams,
}: Props) {
  const { state, pending, onSubmit } = useSaveAction(action);
  const note = describeStoredCopy(state && "saved" in state ? state.saved : stored, bundled);
  const max = (limit: number | null) => limit ?? undefined;

  // Empty slots the admin chose to fill, and filled ones they chose to
  // empty. Both save with the rest of the form; until then "Don't fill"
  // and "Keep" undo them.
  const [filling, setFilling] = useState<string[]>([]);
  const [emptying, setEmptying] = useState<string[]>([]);
  // A save re-renders the page from the saved copy (refresh() in the
  // action), which changes job.slots. Then a slot just filled is filled
  // and one just emptied is empty, so drop them from the lists; kept, a
  // slot filled then emptied would come back as new and be re-filled by
  // the next save. A rejected save doesn't refresh, so the lists stay.
  const [seenSlots, setSeenSlots] = useState(job.slots);
  if (seenSlots !== job.slots) {
    setSeenSlots(job.slots);
    setFilling((current) => current.filter((id) => !job.slots[id]));
    setEmptying((current) => current.filter((id) => job.slots[id]));
  }
  const empty = slots.filter((slot) => !job.slots[slot.id] && !filling.includes(slot.id));

  // The button to focus once it renders, since each of these buttons
  // removes itself: "fill:<id>", "keep:<id>", or "empty:<id>".
  const focusTarget = useRef<string | null>(null);
  const focusWhen = (key: string) => (button: HTMLButtonElement | null) => {
    if (button && focusTarget.current === key) {
      focusTarget.current = null;
      button.focus();
    }
  };
  function unfill(slotId: string) {
    focusTarget.current = `fill:${slotId}`;
    setFilling((current) => current.filter((id) => id !== slotId));
  }
  function emptySlot(slotId: string) {
    focusTarget.current = `keep:${slotId}`;
    setEmptying((current) => [...current, slotId]);
  }
  function keepSlot(slotId: string) {
    focusTarget.current = `empty:${slotId}`;
    setEmptying((current) => current.filter((id) => id !== slotId));
  }

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
          <label htmlFor="status" className="form-label">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={job.status}
            aria-describedby="status-help"
            className="form-input form-input--fit"
          >
            {(Object.keys(STATUS_LABELS) as JobStatus[]).map((status) => (
              <option key={status} value={status} disabled={isDefault && status !== "published"}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <p id="status-help" className="form-help">
            {isDefault
              ? "This is the default job, so it stays published. Make another job the default to take this one off the site."
              : "Drafts and hidden jobs are left out of the home page's job menu, and a link to one shows the default job."}
          </p>
        </div>

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
        <legend className="admin-heading">Slots</legend>
        <p className="form-help">
          Each filled slot&rsquo;s tooltip and what clicking it opens. Emptying a slot keeps its page
          section; clear that below.
        </p>
        {/* Closed by default: open each slot you want to change. Closed
            fields still submit, so saving never drops a tooltip. */}
        {slots.map((slot) => {
          const content = job.slots[slot.id];
          const isNew = !content && filling.includes(slot.id);
          if (!content && !isNew) return null;
          // No fields while emptying, so a required title left blank
          // can't block the save that removes the slot.
          if (content && emptying.includes(slot.id)) {
            return (
              <details key={slot.id} className="form-more">
                <summary>{slot.label}: emptied on save</summary>
                <input type="hidden" name="empty" value={slot.id} />
                <button
                  type="button"
                  ref={focusWhen(`keep:${slot.id}`)}
                  className="form-button form-button--small"
                  onClick={() => keepSlot(slot.id)}
                >
                  Keep {slot.label}
                </button>
              </details>
            );
          }
          return (
            <details key={slot.id} className="form-more" open={isNew || undefined}>
              <summary>
                {slot.label}: {content ? content.tooltip.title : "new"}
              </summary>
              {isNew && <input type="hidden" name="fill" value={slot.id} />}
              <SlotActionFields
                slotId={slot.id}
                action={content?.action ?? { kind: "none" }}
                limits={actionLimits}
                anchorTargets={anchorTargets}
                paramNamePattern={paramNamePattern}
                stackTags={stackTags}
              />
              <SlotTooltipFields
                slotId={slot.id}
                tooltip={content?.tooltip ?? { title: "" }}
                limits={tooltipLimits}
                autoFocus={isNew}
              />
              {isNew ? (
                <button type="button" className="form-button form-button--small" onClick={() => unfill(slot.id)}>
                  Don&rsquo;t fill {slot.label}
                </button>
              ) : (
                <button
                  type="button"
                  ref={focusWhen(`empty:${slot.id}`)}
                  className="form-button form-button--small"
                  onClick={() => emptySlot(slot.id)}
                >
                  Empty {slot.label}
                </button>
              )}
            </details>
          );
        })}
        {empty.length > 0 && (
          <div className="form-field">
            <p className="form-label" id="empty-slots">
              Empty slots
            </p>
            <ul className="slot-fill-list" aria-labelledby="empty-slots">
              {empty.map((slot) => (
                <li key={slot.id}>
                  <button
                    type="button"
                    ref={focusWhen(`fill:${slot.id}`)}
                    className="form-button form-button--small"
                    onClick={() => setFilling((current) => [...current, slot.id])}
                  >
                    Fill {slot.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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

      <CharacterSheetSaveStatus
        state={state}
        pending={pending}
        unknownKeys={unknownKeys}
        deadAnchors={deadAnchors}
        deadParams={deadParams}
      />
      {note && <p className="form-help">{note}</p>}

      <div className="form-actions">
        <button type="submit" className="form-button" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
