import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const { data, response } = await api.GET("/projects/{slug}", {
    params: { path: { slug } },
  });

  // The backend returns a real 404 for an unknown or unpublished slug
  // (see routers/projects.py). next/navigation's notFound() is Next's
  // way of saying "render this route's not-found.tsx / the default 404
  // page" -- it's the frontend honoring the same "doesn't exist" signal
  // the backend already decided on, rather than re-deciding it here.
  if (response.status === 404 || !data) {
    notFound();
  }

  return (
    <main>
      <h1>{data.title}</h1>
      <p>{data.stack.join(", ")}</p>
      {data.repo_url && <a href={data.repo_url}>View repository</a>}

      <article>
        <Markdown>{data.case_study_md}</Markdown>
      </article>
    </main>
  );
}
