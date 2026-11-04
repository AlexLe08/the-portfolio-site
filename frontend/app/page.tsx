import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";
import { CharacterSheet } from "@/components/character-sheet/CharacterSheet";
import { resolveJob } from "@/components/character-sheet/resolve";
import { Sheet } from "@/components/Sheet";
import { StackTags } from "@/components/StackTags";
import { StatusMessage } from "@/components/StatusMessage";
import { api } from "@/lib/api";
import { characterConfig } from "@/lib/character";
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
  const content = await getContent();
  // ?job= only changes emphasis, so every variant points at the one URL.
  return { description: content["site.description"], alternates: { canonical: "/" } };
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // Started together so the content request adds no wait of its own.
  const [projects, content, { job: jobParam }] = await Promise.all([
    loadProjects(),
    getContent(),
    searchParams,
  ]);
  const job = resolveJob(characterConfig, jobParam);
  // The job's page sections, in slot order, labelled like their slots.
  const sections = characterConfig.slots.filter((slot) => job.sections?.[slot.id]);

  return (
    <Sheet
      lead={
        <CharacterSheet
          config={characterConfig}
          job={job}
          renderLink={renderLink}
          renderPortrait={renderPortrait}
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
        <>
          <StatusMessage tone="error">
            Couldn&rsquo;t load projects. The server may be waking up, so try again in a minute.
          </StatusMessage>
          {/* A full reload, not next/link: <Link> to the current URL may
              be served from the client router cache, while a reload
              always fetches again. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="form-button">
            Try again
          </a>
        </>
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