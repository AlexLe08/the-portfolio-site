import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";
import { resolveJob } from "@alexle08/eorzean-character-sheet";
import { CharacterSheet } from "@alexle08/eorzean-character-sheet/react";
import { AutoRetry } from "@/components/AutoRetry";
import { FallbackNotice } from "@/components/FallbackNotice";
import { ProjectsUnavailable } from "@/components/ProjectsUnavailable";
import { Sheet } from "@/components/Sheet";
import { StackTags } from "@/components/StackTags";
import { api } from "@/lib/api";
import { getCharacterConfig } from "@/lib/character";
import { renderLink, renderPortrait } from "@/lib/character-render";
import { getContent, type ContentKey } from "@/lib/content";

// Projects change through the admin UI at any time, so every visit fetches.
// If backend load ever mattered, ISR (`revalidate = 60`) is the next step.
export const dynamic = "force-dynamic";

// The title block's facts row: fixed labels, editable values.
const FACTS: { label: string; key: ContentKey }[] = [
  { label: "role", key: "home.fact.role" },
  { label: "based in", key: "home.fact.location" },
  { label: "status", key: "home.fact.status" },
];

// null when the backend is down or returns an error, so the page can still
// render its copy (which has fallbacks) instead of the whole-page
// app/error.tsx. Catching here means onRequestError never sees the failure,
// so it's reported to Sentry by hand.
async function loadProjects() {
  try {
    const { data, error } = await api.GET("/projects");
    if (data) return data;
    Sentry.captureException(new Error("Failed to load projects"), { extra: { error } });
  } catch (error) {
    // openapi-fetch throws when the backend is unreachable.
    Sentry.captureException(error);
  }
  return null;
}

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getContent();
  // ?job= only changes emphasis, so every variant points at the one URL.
  return { description: content["site.description"], alternates: { canonical: "/" } };
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // Started together so the content and character sheet requests add no
  // wait of their own.
  const [
    projects,
    { content, fallback: contentFallback },
    { config: characterConfig, fallback: characterFallback },
    { job: jobParam },
  ] = await Promise.all([
    loadProjects(),
    getContent(),
    getCharacterConfig(),
    searchParams,
  ]);
  const job = resolveJob(characterConfig, jobParam);
  // The job's page sections, in slot order, labelled like their slots.
  const sections = characterConfig.slots.filter((slot) => job.sections?.[slot.id]);

  const fallback = contentFallback || characterFallback;

  return (
    // One retry loop for everything that failed. The project list has its
    // own message below: it has no built-in copy, so it says so where the
    // list would be.
    <AutoRetry active={fallback || projects === null}>
      <Sheet
        notice={fallback && <FallbackNotice />}
        lead={
          <CharacterSheet
            config={characterConfig}
            job={job}
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

        <div className="section-rule" id="projects">
          <h2 className="section-rule__label">Projects</h2>
        </div>

        {projects === null ? (
          <ProjectsUnavailable />
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
    </AutoRetry>
  );
}