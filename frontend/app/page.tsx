import Link from "next/link";
import { api } from "@/lib/api";

// Without this, Next.js tries to statically pre-render this page once at
// BUILD time -- wrong here, because project data can change any time
// someone POSTs to /projects through the admin API. force-dynamic tells
// Next to run this fetch fresh on every request instead. The trade-off:
// every visit costs one real request to the backend. Fine at this scale;
// if traffic or backend load ever justified it, the next step up is ISR
// (`export const revalidate = 60`) -- cached for 60s, then refreshed in
// the background -- rather than either extreme.
export const dynamic = "force-dynamic";

// No `useState`, no `useEffect`, no loading spinner state to manage.
// This component is an async function because it's a React Server
// Component (the default for anything in app/ that doesn't say "use
// client") -- it runs on the server, during the request, before any HTML
// reaches the browser. The fetch below happens server-side; the person
// visiting the page gets fully-rendered content on the first response,
// not a blank page that then fires off a client-side request.
export default async function HomePage() {
  const { data, error } = await api.GET("/projects");

  if (error) {
    // `error` is typed from the OpenAPI spec's error responses -- this
    // isn't a generic catch-all, TypeScript knows what shape a failure
    // here can take.
    throw new Error("Failed to load projects");
  }

  return (
    <main className="sheet">
      <div className="prose-width">
        <div className="title-block">
          <div className="title-block__heading">
            <h1 className="title-block__name">Alexander Le</h1>
            <p className="title-block__role">
              Full-stack engineer, backend-leaning. TypeScript and Python,
              with four years building production React at CVS Health.
            </p>
          </div>
          <div className="title-block__facts">
            <div className="title-block__fact">
              <div className="title-block__fact-label">role</div>
              <div className="title-block__fact-value">
                Software Engineer
              </div>
            </div>
            <div className="title-block__fact">
              <div className="title-block__fact-label">based in</div>
              <div className="title-block__fact-value">
                Worcester, MA
              </div>
            </div>
            <div className="title-block__fact">
              <div className="title-block__fact-label">status</div>
              <div className="title-block__fact-value">
                Open to opportunities
              </div>
            </div>
          </div>
        </div>

        <p style={{ marginTop: "1.75rem", maxWidth: "62ch" }}>
          This site documents two recent projects end to end: the
          architecture decisions, the tests that caught real bugs, and the
          incidents that shaped the final design. Read a case study below,
          or look at how this site itself is built in{" "}
          <a href="https://github.com/AlexLe08/the-portfolio-site">the repository</a>.
        </p>

        <div className="section-rule">
          <h2 className="section-rule__label">Projects</h2>
        </div>

        <ul className="project-list">
          {data.map((project) => (
            <li key={project.slug}>
              <Link
                href={`/projects/${project.slug}`}
                className="project-card"
              >
                <div className="project-card__title">{project.title}</div>
                <p className="project-card__summary">{project.summary}</p>
                <div className="project-card__stack">
                  {project.stack.map((tech) => (
                    <span className="tag" key={tech}>
                      {tech}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}