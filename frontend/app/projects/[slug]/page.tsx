import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Markdown from "react-markdown";
import Link from "next/link";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

// Memoized per request so generateMetadata and the page share one fetch.
const getProject = cache((slug: string) =>
  api.GET("/projects/{slug}", { params: { path: { slug } } }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await getProject(slug);
  // Missing project: the page itself calls notFound(), so keep the defaults.
  if (!data) return {};
  return {
    title: `${data.title} — Alexander Le`,
    description: data.summary,
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const { data, response } = await getProject(slug);

  // The backend returns a real 404 for an unknown or unpublished slug
  // (see routers/projects.py). next/navigation's notFound() is Next's
  // way of saying "render this route's not-found.tsx / the default 404
  // page" -- it's the frontend honoring the same "doesn't exist" signal
  // the backend already decided on, rather than re-deciding it here.
  if (response.status === 404 || !data) {
    notFound();
  }

  return (
    <main className="sheet">
      <div className="prose-width">
        <Link href="/" className="back-link">
          All projects
        </Link>

        <header className="detail-header">
          <h1 className="detail-header__title">{data.title}</h1>
          <div className="detail-header__stack">
            {data.stack.map((tech) => (
              <span className="tag" key={tech}>
                {tech}
              </span>
            ))}
          </div>
          {data.repo_url && (
            <a href={data.repo_url} className="detail-header__repo">
              View repository
            </a>
          )}
        </header>

        <article className="case-study">
          <Markdown>{data.case_study_md}</Markdown>
        </article>
      </div>
    </main>
  );
}
