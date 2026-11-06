import { useId, type AnchorHTMLAttributes, type ReactNode } from "react";
import { actionHref, jobHref } from "./resolve";
import { SlotHover } from "./SlotHover";
import type {
  CharacterSheetConfig,
  Job,
  Portrait,
  SlotContent,
  SlotDef,
  SlotPosition,
  Theme,
  Tooltip,
} from "./types";
import "./character-sheet.css";

// An equipment-screen style panel:
//   top bar      title, and the job menu
//   header       [header-start slot]  level, emblem, job title  [header-end slot]
//   body         left column | portrait (optional corner badge) | right column
// Slots are links (to a page section, another page, or another site) with
// a compact tooltip on hover or keyboard focus. Slots a job doesn't fill
// render as dimmed empty squares.
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
  // Slot names under the squares: "narrow" shows them only when the panel
  // is narrow (touch screens have no hover tooltip); "always" shows them
  // at every width. Either way they are the slots' accessible names.
  labels?: "narrow" | "always";
  // Decorative extras with no function yet: two socket dots on each filled
  // slot, and a row of round buttons under the portrait. Hidden from
  // assistive tech and not focusable until they do something.
  showSockets?: boolean;
  showToolbar?: boolean;
  // Accessible name for the panel landmark; also the top bar's text when
  // the config sets no title.
  label?: string;
  renderLink?: (props: LinkRendererProps) => ReactNode;
  renderPortrait?: (portrait: Portrait) => ReactNode;
};

type RenderLink = (props: LinkRendererProps) => ReactNode;

function defaultLink({ intent, ...props }: LinkRendererProps) {
  void intent; // a plain link has no use for it
  // eslint-disable-next-line jsx-a11y/anchor-has-content -- children come in through props
  return <a {...props} />;
}

function defaultPortrait(portrait: Portrait) {
  return <img src={portrait.src} alt={portrait.alt} width={portrait.width} height={portrait.height} />;
}

const glyph = (text: string) => text.slice(0, 2);

export function CharacterSheet({
  config,
  job,
  basePath = "/",
  jobParam = "job",
  theme = "document",
  labels = "narrow",
  showSockets = false,
  showToolbar = false,
  label = "Character sheet",
  renderLink = defaultLink,
  renderPortrait = defaultPortrait,
}: CharacterSheetProps) {
  // Tooltip ids must be unique even with two panels on one page.
  const idPrefix = useId();
  const framing = job.portrait?.framing ?? "face";
  const column = { job, idPrefix, renderLink, showSockets, slots: config.slots };

  return (
    <section className="cs" data-cs-theme={theme} data-cs-labels={labels} aria-label={label}>
      <div className="cs__bar">
        <p className="cs__bar-title">{config.title ?? label}</p>
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
                        <span className="cs__jobs-emblem" aria-hidden="true">
                          {option.icon ?? glyph(option.name)}
                        </span>
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

      <div className="cs__header">
        <SlotList position="header-start" {...column} />
        <div className="cs__job">
          <p className="cs__level">
            <span className="cs__level-label">{job.level.label}</span>{" "}
            <span className="cs__level-value">{job.level.value}</span>
          </p>
          <div className="cs__job-line">
            <span className="cs__job-emblem" aria-hidden="true">
              {job.icon ?? glyph(job.name)}
            </span>
            <p className="cs__job-title">{job.title}</p>
          </div>
        </div>
        <SlotList position="header-end" {...column} />
      </div>

      <div className="cs__body">
        <SlotList position="left" {...column} />
        <div className={`cs__portrait cs__portrait--${framing}`}>
          {job.portrait ? renderPortrait(job.portrait) : <PortraitPlaceholder />}
          {job.badge && (
            <p className="cs__badge">
              <span className="cs__badge-label">{job.badge.label}</span>{" "}
              <span className="cs__badge-value">{job.badge.value}</span>
            </p>
          )}
        </div>
        <SlotList position="right" {...column} />
        {showToolbar && <Toolbar />}
      </div>
    </section>
  );
}

function SlotList({
  position,
  slots,
  job,
  idPrefix,
  renderLink,
  showSockets,
}: {
  position: SlotPosition;
  slots: SlotDef[];
  job: Job;
  idPrefix: string;
  renderLink: RenderLink;
  showSockets: boolean;
}) {
  let here = slots.filter((slot) => slot.position === position);
  // One slot each side of the job title; parseConfig reports any extras.
  if (position === "header-start" || position === "header-end") here = here.slice(0, 1);
  const className = `cs__slots cs__slots--${position}`;
  if (here.length === 0) return <div className={className} />;

  return (
    <ul className={className}>
      {here.map((slot) => (
        <Slot
          key={slot.id}
          slot={slot}
          content={job.slots[slot.id]}
          tipId={`${idPrefix}tip-${slot.id}`}
          renderLink={renderLink}
          showSockets={showSockets}
        />
      ))}
    </ul>
  );
}

function SlotIcon({ slot, content }: { slot: SlotDef; content?: SlotContent }) {
  if (content?.iconSrc) {
    // Decorative: the slot's label is its accessible name.
    return <img className="cs-slot__img" src={content.iconSrc} alt="" />;
  }
  return <>{slot.icon ?? glyph(slot.label)}</>;
}

function Slot({
  slot,
  content,
  tipId,
  renderLink,
  showSockets,
}: {
  slot: SlotDef;
  content: SlotContent | undefined;
  tipId: string;
  renderLink: RenderLink;
  showSockets: boolean;
}) {
  const face = (
    <>
      <span className="cs-slot__square" aria-hidden="true">
        <SlotIcon slot={slot} content={content} />
        {showSockets && content && (
          <span className="cs-slot__sockets">
            <span className="cs-slot__socket" />
            <span className="cs-slot__socket" />
          </span>
        )}
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

  const { action } = content;
  const href = actionHref(action);
  const common = { className: "cs-slot__face", "aria-describedby": tipId };

  let trigger: ReactNode;
  if (href === null) {
    // Nothing to open, but still focusable so keyboard users get the tooltip.
    trigger = (
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focus shows the tooltip it's described by
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
        <SlotTooltip id={tipId} slot={slot} content={content} />
      </SlotHover>
    </li>
  );
}

// A compact item card: icon and title block, an optional headline figure,
// then the details.
function SlotTooltip({ id, slot, content }: { id: string; slot: SlotDef; content: SlotContent }) {
  const tooltip: Tooltip = content.tooltip;
  const items = tooltip.items ?? [];
  const pairs = items.filter((item) => typeof item !== "string");
  const lines = items.filter((item) => typeof item === "string");

  return (
    <div className="cs-tip" role="tooltip" id={id}>
      <div className="cs-tip__head">
        <span className="cs-tip__icon" aria-hidden="true">
          <SlotIcon slot={slot} content={content} />
        </span>
        <div className="cs-tip__heading">
          {tooltip.tags && (
            <p className="cs-tip__tags">
              {tooltip.tags.map((tag) => (
                <span key={tag}>{tag} </span>
              ))}
            </p>
          )}
          <p className="cs-tip__title">{tooltip.title}</p>
          <p className="cs-tip__category">{tooltip.subtitle ?? slot.label}</p>
        </div>
      </div>
      {tooltip.stat && (
        <p className="cs-tip__stat">
          <span className="cs-tip__stat-label">{tooltip.stat.label}</span>{" "}
          <span className="cs-tip__stat-value">{tooltip.stat.value}</span>
        </p>
      )}
      {(items.length > 0 || tooltip.note) && (
        <div className="cs-tip__body">
          {pairs.length > 0 && (
            <dl className="cs-tip__pairs">
              {pairs.map((pair) => (
                <div key={pair.label} className="cs-tip__pair">
                  <dt>{pair.label}</dt>
                  <dd>{pair.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {lines.length > 0 && (
            <ul className="cs-tip__items">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {tooltip.note && <p className="cs-tip__note">{tooltip.note}</p>}
        </div>
      )}
    </div>
  );
}

// Round buttons under the portrait: three each side, the first two lit.
// Visual only for now; when they get a job, make them real <button>s.
const TOOLBAR_GLYPHS = { start: ["◐", "◑", "↻"], end: ["△", "◎", "↺"] };

function Toolbar() {
  return (
    <div className="cs__toolbar" aria-hidden="true">
      {(["start", "end"] as const).map((side) => (
        <span key={side} className={`cs__toolbar-group cs__toolbar-group--${side}`}>
          {TOOLBAR_GLYPHS[side].map((glyph, index) => (
            <span
              key={glyph}
              className={`cs__toolbar-button${side === "start" && index < 2 ? " cs__toolbar-button--lit" : ""}`}
            >
              {glyph}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

function PortraitPlaceholder() {
  return (
    <svg className="cs__placeholder" viewBox="0 0 100 200" role="img" aria-label="No portrait yet">
      <circle cx="50" cy="34" r="17" />
      <path d="M22 200V96c0-26 12-42 28-42s28 16 28 42v104z" />
    </svg>
  );
}
