"use client";

import { useState } from "react";
import type { SlotAction } from "@alexle08/eorzean-character-sheet";
import { openDetails } from "@/components/SlotTooltipFields";
import { PROJECTS_ANCHOR, STACK_PARAM } from "@/lib/character-anchors";

// Read from the package's LIMITS by the page, like TooltipFieldLimits.
export type SlotActionLimits = Record<"target" | "href" | "paramName" | "paramValue", number | null>;

type Props = {
  slotId: string;
  action: SlotAction;
  limits: SlotActionLimits;
  // Ids the home page renders for this job (its sections, then the
  // project list), offered for anchors. Others can still be typed.
  anchorTargets: string[];
  // PARAM_NAME_PATTERN's source, passed in so zod stays out of the bundle.
  paramNamePattern: string;
  // Published projects' stack tags, offered as values for ?stack=.
  stackTags: string[];
};

const KINDS: { kind: SlotAction["kind"]; label: string }[] = [
  { kind: "none", label: "Nothing (tooltip only)" },
  { kind: "anchor", label: "A section on the home page" },
  { kind: "link", label: "A page on this site" },
  { kind: "external", label: "Another website" },
  { kind: "param", label: "A query parameter on this page" },
];

// What clicking one slot does, inside CharacterJobForm. Only the selected
// kind's inputs are rendered, so only they submit; field names start with
// "action.<slot id>.", which updateCharacterJob reads back.
export function SlotActionFields({
  slotId,
  action,
  limits,
  anchorTargets,
  paramNamePattern,
  stackTags,
}: Props) {
  const [kind, setKind] = useState(action.kind);
  // Tracked only to offer stack tags as values while the name is "stack".
  const savedParam = action.kind === "param" ? action : null;
  const [paramName, setParamName] = useState(savedParam?.name ?? "");
  const name = (field: string) => `action.${slotId}.${field}`;
  const id = (field: string) => `action-${slotId}-${field}`;
  const max = (limit: number | null) => limit ?? undefined;
  // Switching kind unmounts the other inputs, so switching back shows the
  // saved value again rather than what was typed.
  const href = action.kind === "link" || action.kind === "external" ? action.href : "";
  // Shared by anchors and a param action's target; one kind renders at a time.
  const targetList = (
    <datalist id={id("targets")}>
      {anchorTargets.map((target) => (
        <option key={target} value={target} />
      ))}
    </datalist>
  );

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
          onChange={(event) => {
            setKind(event.target.value as SlotAction["kind"]);
            // The name input remounts with the saved name.
            setParamName(savedParam?.name ?? "");
          }}
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
          {targetList}
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

      {kind === "param" && (
        <>
          <div className="form-field">
            <label htmlFor={id("name")} className="form-label">
              Parameter name
            </label>
            <input
              id={id("name")}
              name={name("name")}
              required
              onInvalid={openDetails}
              maxLength={max(limits.paramName)}
              pattern={paramNamePattern}
              defaultValue={savedParam?.name ?? ""}
              onChange={(event) => setParamName(event.target.value)}
              list={id("names")}
              aria-describedby={id("name-help")}
              autoCapitalize="off"
              spellCheck={false}
              className="form-input"
            />
            <datalist id={id("names")}>
              <option value={STACK_PARAM} />
            </datalist>
            <p id={id("name-help")} className="form-help">
              Lowercase letters, digits, underscores, and hyphens; starts with a letter; not job.
              The home page reads {STACK_PARAM}, which shows only the projects using one stack tag.
            </p>
          </div>
          <div className="form-field">
            <label htmlFor={id("value")} className="form-label">
              Value
            </label>
            <input
              id={id("value")}
              name={name("value")}
              required
              onInvalid={openDetails}
              maxLength={max(limits.paramValue)}
              defaultValue={savedParam?.value ?? ""}
              list={paramName.trim() === STACK_PARAM ? id("values") : undefined}
              className="form-input"
            />
            {paramName.trim() === STACK_PARAM && (
              <datalist id={id("values")}>
                {stackTags.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            )}
          </div>
          <div className="form-field">
            <label htmlFor={id("target")} className="form-label">
              Then scroll to
            </label>
            <input
              id={id("target")}
              name={name("target")}
              maxLength={max(limits.target)}
              // A new param action scrolls to the list it most likely filters.
              defaultValue={savedParam ? (savedParam.target ?? "") : PROJECTS_ANCHOR}
              list={id("targets")}
              aria-describedby={id("param-target-help")}
              className="form-input"
            />
            {targetList}
            <p id={id("param-target-help")} className="form-help">
              Optional. A section id, without the #; empty keeps the scroll position.
            </p>
          </div>
        </>
      )}
    </>
  );
}
