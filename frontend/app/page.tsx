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
    <main>
      <h1>Alexander Le</h1>
      <p>Full-stack projects and case studies.</p>

      <ul>
        {data.map((project) => (
          <li key={project.slug}>
            <Link href={`/projects/${project.slug}`}>{project.title}</Link>
            <p>{project.summary}</p>
            <p>{project.stack.join(", ")}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
