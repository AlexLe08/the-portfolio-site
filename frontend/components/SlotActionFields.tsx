"use client";

import { useState } from "react";
import type { SlotAction } from "@/components/character-sheet/types";
import { openDetails } from "@/components/SlotTooltipFields";

// Read from the zod schema by the page, like TooltipFieldLimits.
export type SlotActionLimits = Record<"target" | "href", number | null>;

type Props = {
  slotId: string;
  action: SlotAction;
  limits: SlotActionLimits;
  // Ids the home page renders for this job (its sections, then the
  // project list), offered for anchors. Others can still be typed.
  anchorTargets: string[];
};

const KINDS: { kind: SlotAction["kind"]; label: string }[] = [
  { kind: "none", label: "Nothing (tooltip only)" },
  { kind: "anchor", label: "A section on the home page" },
  { kind: "link", label: "A page on this site" },
  { kind: "external", label: "Another website" },
];

// What clicking one slot does, inside CharacterJobForm. Only the selected
// kind's inputs are rendered, so only they submit; field names start with
// "action.<slot id>.", which updateCharacterJob reads back.
export function SlotActionFields({ slotId, action, limits, anchorTargets }: Props) {
  const [kind, setKind] = useState(action.kind);
  const name = (field: string) => `action.${slotId}.${field}`;
  const id = (field: string) => `action-${slotId}-${field}`;
  const max = (limit: number | null) => limit ?? undefined;
  // Switching kind unmounts the other inputs, so switching back shows the
  // saved value again rather than what was typed.
  const href = action.kind === "link" || action.kind === "external" ? action.href : "";

  return (
    <>
      <div className="form-field">
        <label htmlFor={id("kind")} className="form-label">
          Clicking it opens
        </label>
        <select
          id={id("kind")}
          name={name("kind")}
          value={kind}
          onChange={(event) => setKind(event.target.value as SlotAction["kind"])}
          className="form-input"
        >
          {KINDS.map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {kind === "anchor" && (
        <div className="form-field">
          <label htmlFor={id("target")} className="form-label">
            Section id
          </label>
          <input
            id={id("target")}
            name={name("target")}
            required
            onInvalid={openDetails}
            maxLength={max(limits.target)}
            defaultValue={action.kind === "anchor" ? action.target : ""}
            list={id("targets")}
            aria-describedby={id("target-help")}
            className="form-input"
          />
          <datalist id={id("targets")}>
            {anchorTargets.map((target) => (
              <option key={target} value={target} />
            ))}
          </datalist>
          <p id={id("target-help")} className="form-help">
            Without the #. This job&rsquo;s sections use their slot&rsquo;s id, for example:{" "}
            {anchorTargets.join(", ")}
          </p>
        </div>
      )}

      {kind === "link" && (
        <div className="form-field">
          <label htmlFor={id("href")} className="form-label">
            Path
          </label>
          <input
            id={id("href")}
            name={name("href")}
            required
            onInvalid={openDetails}
            maxLength={max(limits.href)}
            defaultValue={action.kind === "link" ? href : ""}
            placeholder="/contact"
            aria-describedby={id("href-help")}
            className="form-input"
          />
          <p id={id("href-help")} className="form-help">
            Starts with a single /, for example: /contact
          </p>
        </div>
      )}

      {kind === "external" && (
        <>
          <div className="form-field">
            <label htmlFor={id("href")} className="form-label">
              URL
            </label>
            <input
              id={id("href")}
              name={name("href")}
              type="url"
              required
              onInvalid={openDetails}
              maxLength={max(limits.href)}
              defaultValue={action.kind === "external" ? href : ""}
              placeholder="https://"
              className="form-input"
            />
          </div>
          <div className="form-check">
            <input
              id={id("new_tab")}
              name={name("new_tab")}
              type="checkbox"
              defaultChecked={action.kind === "external" && action.newTab === true}
            />
            <label htmlFor={id("new_tab")}>Open in a new tab</label>
          </div>
        </>
      )}
    </>
  );
}
