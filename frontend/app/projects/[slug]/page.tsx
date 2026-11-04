import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Markdown from "react-markdown";
import { Sheet } from "@/components/Sheet";
import { StackTags } from "@/components/StackTags";
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
    title: data.title,
    description: data.summary,
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const { data, response } = await getProject(slug);

  // The backend decides what exists: unknown and unpublished slugs are 404s.
  if (response.status === 404) {
    notFound();
  }
  // Any other failure (a 500 during an outage) is an error, not a missing
  // page: app/error.tsx shows it with a retry button.
  if (!data) {
    throw new Error("Failed to load project");
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
