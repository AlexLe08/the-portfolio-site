"use client";

import { type FormEvent, useRef, useState } from "react";
import type { Tooltip } from "@solution-nine/wol-character-panel";

// Read from the zod schema by the page, like JobFieldLimits.
export type TooltipFieldLimits = Record<
  "title" | "tag" | "subtitle" | "statLabel" | "statValue" | "itemLabel" | "itemValue" | "note",
  number | null
> &
  Record<"maxTags" | "maxItems", number>;

type Props = {
  slotId: string;
  tooltip: Tooltip;
  limits: TooltipFieldLimits;
  // For a slot just filled with a button, which disappears.
  autoFocus?: boolean;
};

// For required fields inside a <details> the admin may have closed again:
// the browser blocks the save but can't show its message on a hidden field.
export function openDetails(event: FormEvent<HTMLElement>) {
  const details = event.currentTarget.closest("details");
  if (details) details.open = true;
}

// One slot's tooltip, inside CharacterJobForm. Field names start with
// "tooltip.<slot id>.", which updateCharacterJob reads back.
export function SlotTooltipFields({ slotId, tooltip, limits, autoFocus }: Props) {
  const name = (field: string) => `tooltip.${slotId}.${field}`;
  const id = (field: string) => `tooltip-${slotId}-${field}`;
  const max = (limit: number | null) => limit ?? undefined;

  return (
    <>
      <div className="form-field">
        <label htmlFor={id("title")} className="form-label">
          Title
        </label>
        <input
          id={id("title")}
          name={name("title")}
          required
          maxLength={max(limits.title)}
          defaultValue={tooltip.title}
          autoFocus={autoFocus}
          onInvalid={openDetails}
          className="form-input"
        />
      </div>

      <div className="form-field">
        <label htmlFor={id("subtitle")} className="form-label">
          Subtitle
        </label>
        <input
          id={id("subtitle")}
          name={name("subtitle")}
          maxLength={max(limits.subtitle)}
          defaultValue={tooltip.subtitle ?? ""}
          className="form-input"
        />
      </div>

      <div className="form-field">
        <label htmlFor={id("tags")} className="form-label">
          Tags
        </label>
        <input
          id={id("tags")}
          name={name("tags")}
          defaultValue={tooltip.tags?.join(", ") ?? ""}
          aria-describedby={id("tags-help")}
          className="form-input"
        />
        <p id={id("tags-help")} className="form-help">
          Optional. Up to {limits.maxTags}, separated by commas, {limits.tag} characters each.
        </p>
      </div>

      <div className="form-field">
        <span className="form-label" id={id("stat")}>
          Stat
        </span>
        <div className="tooltip-pair" role="group" aria-labelledby={id("stat")}>
          <input
            name={name("stat_label")}
            aria-label="Stat label"
            placeholder="Label"
            maxLength={max(limits.statLabel)}
            defaultValue={tooltip.stat?.label ?? ""}
            className="form-input"
          />
          <input
            name={name("stat_value")}
            aria-label="Stat value"
            placeholder="Value"
            maxLength={max(limits.statValue)}
            defaultValue={tooltip.stat?.value ?? ""}
            className="form-input"
          />
        </div>
        <p className="form-help">Optional. One headline figure; fill both or neither.</p>
      </div>

      <TooltipItemsEditor name={name} items={tooltip.items ?? []} limits={limits} />

      <div className="form-field">
        <label htmlFor={id("note")} className="form-label">
          Note
        </label>
        <textarea
          id={id("note")}
          name={name("note")}
          rows={2}
          maxLength={max(limits.note)}
          defaultValue={tooltip.note ?? ""}
          className="form-input form-textarea"
        />
      </div>
    </>
  );
}

type Row = { key: number; label: string; value: string };

// Items mix plain lines and label/value pairs, so every row has both
// inputs and an empty label means a plain line. The inputs are
// uncontrolled: rows are keyed, so moving one moves its typed values too.
function TooltipItemsEditor({
  name,
  items,
  limits,
}: {
  name: (field: string) => string;
  items: NonNullable<Tooltip["items"]>;
  limits: TooltipFieldLimits;
}) {
  const nextKey = useRef(items.length);
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((item, key) =>
      typeof item === "string" ? { key, label: "", value: item } : { key, ...item },
    ),
  );
  // A row added by the button, whose first input takes focus once React
  // attaches it (see the ref callback below).
  const focusKey = useRef<number | null>(null);
  const max = (limit: number | null) => limit ?? undefined;

  function add() {
    const key = nextKey.current++;
    focusKey.current = key;
    setRows((current) => [...current, { key, label: "", value: "" }]);
  }

  function move(index: number, by: -1 | 1) {
    setRows((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  const remove = (key: number) => setRows((current) => current.filter((row) => row.key !== key));

  return (
    <fieldset className="form-field tooltip-items">
      <legend className="form-label">Items</legend>
      <p className="form-help">
        Most relevant first, up to {limits.maxItems}. With a label, a row shows as a label and value;
        without one, as a plain line.
      </p>
      {rows.length > 0 && (
        <ol className="tooltip-items__list">
          {rows.map((row, index) => {
            const which = <span className="visually-hidden"> item {index + 1}</span>;
            return (
              <li key={row.key} className="tooltip-items__row">
                <div className="tooltip-pair">
                  <input
                    ref={(input) => {
                      if (input && focusKey.current === row.key) {
                        focusKey.current = null;
                        input.focus();
                      }
                    }}
                    name={name("item_label")}
                    aria-label={`Item ${index + 1} label`}
                    placeholder="Label (optional)"
                    maxLength={max(limits.itemLabel)}
                    defaultValue={row.label}
                    className="form-input"
                  />
                  <input
                    name={name("item_value")}
                    aria-label={`Item ${index + 1} text`}
                    placeholder="Text"
                    maxLength={max(limits.itemValue)}
                    defaultValue={row.value}
                    className="form-input"
                  />
                </div>
                <div className="tooltip-items__buttons">
                  <button
                    type="button"
                    className="form-button form-button--small"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    Up{which}
                  </button>
                  <button
                    type="button"
                    className="form-button form-button--small"
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Down{which}
                  </button>
                  <button
                    type="button"
                    className="form-button form-button--small"
                    onClick={() => remove(row.key)}
                  >
                    Remove{which}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <button
        type="button"
        className="form-button form-button--small"
        disabled={rows.length >= limits.maxItems}
        onClick={add}
      >
        Add item
      </button>
    </fieldset>
  );
}
