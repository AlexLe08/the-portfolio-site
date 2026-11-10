import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Markdown from "react-markdown";
import { Sheet } from "@/components/Sheet";
import { StackTags } from "@/components/StackTags";
import { getProject } from "@/lib/projects";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Per request, like the page: no build-time prerender, which would need the backend.
  await connection();
  const { slug } = await params;
  const data = await getProject(slug);
  // Missing project: the page itself calls notFound(), so keep the defaults.
  if (!data) return {};
  return {
    title: data.title,
    description: data.summary,
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  // Rendered per request (data from the cache in lib/projects.ts), never
  // prerendered at build time, which would need the backend.
  await connection();
  const { slug } = await params;
  // Any failure other than a 404 (a 500 during an outage) throws: that's
  // an error, not a missing page, and app/error.tsx shows it with a retry
  // button.
  const data = await getProject(slug);

  // The backend decides what exists: unknown and unpublished slugs are 404s.
  if (!data) {
    notFound();
  }

  return (
    <Sheet
      title={data.title}
      back={{ href: "/", label: "All projects" }}
      header={
        <>
          <StackTags stack={data.stack} className="detail-header__stack" />
          {data.repo_url && (
            <a href={data.repo_url} className="detail-header__repo">
              View repository
            </a>
          )}
        </>
      }
    >
      <article className="case-study">
        <Markdown>{data.case_study_md}</Markdown>
      </article>
    </Sheet>
  );
}
