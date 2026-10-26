import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";
import { StackTags } from "@/components/StackTags";
import { api } from "@/lib/api";
import { getContent, type ContentKey } from "@/lib/content";

// Without this, Next.js tries to statically pre-render this page once at
// BUILD time -- wrong here, because project data can change any time
// someone POSTs to /projects through the admin API. force-dynamic tells
// Next to run this fetch fresh on every request instead. The trade-off:
// every visit costs one real request to the backend. Fine at this scale;
// if traffic or backend load ever justified it, the next step up is ISR
// (`export const revalidate = 60`) -- cached for 60s, then refreshed in
// the background -- rather than either extreme.
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
  return { description: content["site.description"] };
}

// No `useState`, no `useEffect`, no loading spinner state to manage.
// This component is an async function because it's a React Server
// Component (the default for anything in app/ that doesn't say "use
// client") -- it runs on the server, during the request, before any HTML
// reaches the browser. The fetch below happens server-side; the person
// visiting the page gets fully-rendered content on the first response,
// not a blank page that then fires off a client-side request.
export default async function HomePage() {
  // Started together so the content request adds no wait of its own.
  const [projects, content] = await Promise.all([loadProjects(), getContent()]);

  return (
    <main className="sheet">
      <div className="prose-width">
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

        <div className="intro" style={{ marginTop: "1.75rem" }}>
          <Markdown>{content["home.intro"]}</Markdown>
        </div>

        <div className="section-rule">
          <h2 className="section-rule__label">Projects</h2>
        </div>

        {projects === null ? (
          <>
            <div className="form-status form-status--error" role="alert">
              Couldn&rsquo;t load projects. The server may be waking up, so try again in a minute.
            </div>
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
              <li key={project.slug}>
                <Link
                  href={`/projects/${project.slug}`}
                  className="project-card"
                >
                  <div className="project-card__title">{project.title}</div>
                  <p className="project-card__summary">{project.summary}</p>
                  <StackTags stack={project.stack} className="project-card__stack" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}