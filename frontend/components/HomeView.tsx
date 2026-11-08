import Link from "next/link";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import { jobHref, withQuery, type CharacterSheetConfig, type Job } from "@alexle08/eorzean-character-sheet";
import { CharacterSheet } from "@alexle08/eorzean-character-sheet/react";
import { ProjectsUnavailable } from "@/components/ProjectsUnavailable";
import { Sheet } from "@/components/Sheet";
import { StackTags } from "@/components/StackTags";
import { StatusMessage } from "@/components/StatusMessage";
import {
  filterByStack,
  homeSections,
  PROJECTS_ANCHOR,
  readStackParam,
  STACK_PARAM,
  stackParamActive,
} from "@/lib/character-anchors";
import { renderLink, renderPortrait } from "@/lib/character-render";
import type { ContentKey, SiteContent } from "@/lib/content";
import type { ProjectSummary } from "@/lib/projects";

// The title block's facts row: fixed labels, editable values.
const FACTS: { label: string; key: ContentKey }[] = [
  { label: "role", key: "home.fact.role" },
  { label: "based in", key: "home.fact.location" },
  { label: "status", key: "home.fact.status" },
];

type Props = {
  config: CharacterSheetConfig;
  job: Job;
  content: SiteContent;
  // null when loading them failed.
  projects: ProjectSummary[] | null;
  // Where the job menu links (the admin preview keeps its own path).
  basePath?: string;
  // ?stack=, which filters the project list by one stack tag.
  stack?: string | string[];
  notice?: ReactNode;
};

// The home page's body, shared by app/page.tsx (published jobs only) and
// the admin preview (every job), so the preview can't drift from it.
export function HomeView({ config, job, content, projects, basePath, stack, notice }: Props) {
  // The job's page sections, in slot order, labelled like their slots.
  // Their ids are the anchor targets the admin editor checks against.
  const sections = homeSections(config, job);
  // This job's page without the filter: where "Show all projects" goes.
  const jobUrl = jobHref(config, job.id, basePath);
  const filter = projects && filterByStack(projects, stack);
  const shown = filter?.projects ?? projects ?? [];
  // A reload of this page, filter included (none adds nothing).
  const retryHref = withQuery(jobUrl, { [STACK_PARAM]: readStackParam(stack) });

  return (
    <Sheet
      notice={notice}
      lead={
        <CharacterSheet
          config={config}
          job={job}
          basePath={basePath}
          renderLink={renderLink}
          renderPortrait={renderPortrait}
          isParamActive={stackParamActive(stack)}
          showSockets
          showToolbar
        />
      }
    >
      <div className="title-block">
        <div className="title-block__heading">
          <h1 className="title-block__name">Alexander Le</h1>
          <p className="title-block__role">{content["home.role"]}</p>
        </div>
        <div className="title-block__facts">
          {FACTS.map(({ label, key }) => (
            <div className="title-block__fact" key={key}>
              <div className="title-block__fact-label">{label}</div>
              <div className="title-block__fact-value">{content[key]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="intro home-intro">
        <Markdown>{content["home.intro"]}</Markdown>
      </div>

      {sections.map((slot) => (
        <section key={slot.id} aria-labelledby={`${slot.id}-heading`}>
          <div className="section-rule" id={slot.id}>
            <h2 className="section-rule__label" id={`${slot.id}-heading`}>
              {slot.label}
            </h2>
          </div>
          <div className="intro job-section">
            <Markdown>{job.sections?.[slot.id]}</Markdown>
          </div>
        </section>
      ))}

      <div className="section-rule" id={PROJECTS_ANCHOR}>
        <h2 className="section-rule__label">Projects</h2>
      </div>

      {projects === null ? (
        <ProjectsUnavailable retryHref={retryHref} />
      ) : (
        <>
          {/* The URL's value isn't echoed: only a tag a project really has. */}
          {filter && (
            <StatusMessage tone="info">
              {filter.tag ? `Showing projects using ${filter.tag}. ` : "No published projects use that stack. "}
              <Link href={withQuery(jobUrl, {}, PROJECTS_ANCHOR)}>Show all projects</Link>
            </StatusMessage>
          )}
          {shown.length > 0 && (
            <ul className="project-list">
              {shown.map((project) => (
                <li key={project.slug} className="project-card">
                  <h3 className="project-card__title">
                    <Link href={`/projects/${project.slug}`} className="project-card__link">
                      {project.title}
                    </Link>
                  </h3>
                  <p className="project-card__summary">{project.summary}</p>
                  <StackTags stack={project.stack} className="project-card__stack" />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Sheet>
  );
}
