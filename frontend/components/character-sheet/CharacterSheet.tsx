import { useId, type AnchorHTMLAttributes, type ReactNode } from "react";
import { actionHref, jobHref } from "./resolve";
import { SlotHover } from "./SlotHover";
import type { CharacterSheetConfig, Job, Portrait, SlotContent, SlotDef, Theme } from "./types";
import "./character-sheet.css";

// An equipment-screen style panel: a job header, slot squares in two
// columns around a portrait, and a job menu. Slots are links (to a page
// section, another page, or another site) with a tooltip on hover/focus.
//
// A Server Component with no framework imports. The host passes its own
// link and image components, so in Next.js links use <Link> and the
// portrait goes through next/image; anywhere else the defaults are plain
// <a> and <img>.

export type LinkRendererProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  // "job": swaps the job on the same page (a host may want to keep the
  // scroll position). "page": goes to another page on the site.
  intent: "job" | "page";
};

export type CharacterSheetProps = {
  config: CharacterSheetConfig;
  job: Job;
  // The page the panel is on, for job links (?job=<id>).
  basePath?: string;
  jobParam?: string;
  theme?: Theme;
  // Accessible name for the panel landmark.
  label?: string;
  renderLink?: (props: LinkRendererProps) => ReactNode;
  renderPortrait?: (portrait: Portrait) => ReactNode;
};

function defaultLink({ intent, ...props }: LinkRendererProps) {
  void intent; // a plain link has no use for it
  return <a {...props} />;
}

function defaultPortrait(portrait: Portrait) {
  // eslint-disable-next-line @next/next/no-img-element -- framework-neutral default; hosts pass their own
  return <img src={portrait.src} alt={portrait.alt} width={portrait.width} height={portrait.height} />;
}

export function CharacterSheet({
  config,
  job,
  basePath = "/",
  jobParam = "job",
  theme = "document",
  label = "Character sheet",
  renderLink = defaultLink,
  renderPortrait = defaultPortrait,
}: CharacterSheetProps) {
  const left = config.slots.filter((slot) => slot.side === "left");
  const right = config.slots.filter((slot) => slot.side === "right");
  // Tooltip ids must be unique even with two panels on one page.
  const idPrefix = useId();
  const framing = job.portrait?.framing ?? "face";

  return (
    <section className="cs" data-cs-theme={theme} aria-label={label}>
      <div className="cs__header">
        <div className="cs__job">
          <p className="cs__job-title">{job.title}</p>
          <p className="cs__level">
            <span className="cs__level-label">{job.level.label}</span>{" "}
            <span className="cs__level-value">{job.level.value}</span>
          </p>
        </div>
        {config.jobs.length > 1 && (
          // Keyed by job so the menu closes after a job change, which
          // re-renders this panel without reloading the page.
          <details className="cs__jobs" key={job.id}>
            <summary className="cs__jobs-toggle">Change job</summary>
            <ul className="cs__jobs-list">
              {config.jobs.map((option) => (
                <li key={option.id}>
                  {renderLink({
                    href: jobHref(config, option.id, basePath, jobParam),
                    intent: "job",
                    className: "cs__jobs-link",
                    "aria-current": option.id === job.id ? "true" : undefined,
                    children: (
                      <>
                        <span className="cs__jobs-name">{option.name}</span>
                        <span className="cs__jobs-level">
                          {option.level.label} {option.level.value}
                        </span>
                      </>
                    ),
                  })}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className={`cs__body cs__body--${framing}`}>
        <SlotColumn side="left" slots={left} job={job} idPrefix={idPrefix} renderLink={renderLink} />
        <div className={`cs__portrait cs__portrait--${framing}`}>
          {job.portrait ? renderPortrait(job.portrait) : <PortraitPlaceholder />}
        </div>
        <SlotColumn side="right" slots={right} job={job} idPrefix={idPrefix} renderLink={renderLink} />
      </div>
    </section>
  );
}

function SlotColumn({
  side,
  slots,
  job,
  idPrefix,
  renderLink,
}: {
  side: "left" | "right";
  slots: SlotDef[];
  job: Job;
  idPrefix: string;
  renderLink: (props: LinkRendererProps) => ReactNode;
}) {
  if (slots.length === 0) return <div className={`cs__slots cs__slots--${side}`} />;
  return (
    <ul className={`cs__slots cs__slots--${side}`}>
      {slots.map((slot) => (
        <Slot
          key={slot.id}
          slot={slot}
          content={job.slots[slot.id]}
          tipId={`${idPrefix}tip-${slot.id}`}
          renderLink={renderLink}
        />
      ))}
    </ul>
  );
}

function Slot({
  slot,
  content,
  tipId,
  renderLink,
}: {
  slot: SlotDef;
  content: SlotContent | undefined;
  tipId: string;
  renderLink: (props: LinkRendererProps) => ReactNode;
}) {
  const face = (
    <>
      <span className="cs-slot__square" aria-hidden="true">
        {slot.icon ?? slot.label.slice(0, 2)}
      </span>
      <span className="cs-slot__label">{slot.label}</span>
    </>
  );

  if (!content) {
    return (
      <li className="cs-slot cs-slot--empty">
        <span className="cs-slot__face">
          {face}
          <span className="cs-visually-hidden"> (empty)</span>
        </span>
      </li>
    );
  }

  const { action, tooltip } = content;
  const href = actionHref(action);
  const common = { className: "cs-slot__face", "aria-describedby": tipId };

  let trigger: ReactNode;
  if (href === null) {
    // Nothing to open, but still focusable so keyboard users get the tooltip.
    trigger = (
      <span {...common} tabIndex={0}>
        {face}
      </span>
    );
  } else if (action.kind === "link") {
    trigger = renderLink({ ...common, href, intent: "page", children: face });
  } else if (action.kind === "external" && action.newTab) {
    trigger = (
      <a {...common} href={href} target="_blank" rel="noopener noreferrer">
        {face}
        <span className="cs-visually-hidden"> (opens in a new tab)</span>
      </a>
    );
  } else {
    trigger = (
      <a {...common} href={href}>
        {face}
      </a>
    );
  }

  return (
    <li className={`cs-slot cs-slot--${action.kind}`}>
      <SlotHover>
        {trigger}
        <div className="cs-tip" role="tooltip" id={tipId}>
          <p className="cs-tip__title">{tooltip.title}</p>
          {tooltip.subtitle && <p className="cs-tip__subtitle">{tooltip.subtitle}</p>}
          {tooltip.items && tooltip.items.length > 0 && (
            <ul className="cs-tip__items">
              {tooltip.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {tooltip.note && <p className="cs-tip__note">{tooltip.note}</p>}
        </div>
      </SlotHover>
    </li>
  );
}

function PortraitPlaceholder() {
  return (
    <svg className="cs__placeholder" viewBox="0 0 100 120" role="img" aria-label="No portrait yet">
      <circle cx="50" cy="42" r="20" />
      <path d="M14 120c0-24 16-40 36-40s36 16 36 40z" />
    </svg>
  );
}
