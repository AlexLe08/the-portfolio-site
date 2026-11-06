import Link from "next/link";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import { jobHref, type CharacterSheetConfig, type Job } from "@alexle08/eorzean-character-sheet";
import { CharacterSheet } from "@alexle08/eorzean-character-sheet/react";
import { ProjectsUnavailable } from "@/components/ProjectsUnavailable";
import { Sheet } from "@/components/Sheet";
import { StackTags } from "@/components/StackTags";
import { homeSections, PROJECTS_ANCHOR } from "@/lib/character-anchors";
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
  notice?: ReactNode;
};

// The home page's body, shared by app/page.tsx (published jobs only) and
// the admin preview (every job), so the preview can't drift from it.
export function HomeView({ config, job, content, projects, basePath, notice }: Props) {
  // The job's page sections, in slot order, labelled like their slots.
  // Their ids are the anchor targets the admin editor checks against.
  const sections = homeSections(config, job);

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
        <ProjectsUnavailable retryHref={jobHref(config, job.id, basePath)} />
      ) : (
        <ul className="project-list">
          {projects.map((project) => (
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
    </Sheet>
  );
}
