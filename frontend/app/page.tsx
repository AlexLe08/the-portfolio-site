import type { Metadata } from "next";
import { resolveJob } from "@solution-nine/wol-character-panel";
import { AutoRetry } from "@/components/AutoRetry";
import { FallbackNotice } from "@/components/FallbackNotice";
import { HomeView } from "@/components/HomeView";
import { getCharacterConfig } from "@/lib/character";
import { getContent } from "@/lib/content";
import { loadProjects } from "@/lib/projects";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getContent();
  // ?job= only changes emphasis and ?stack= only filters the project list,
  // so every variant points at the one URL.
  return { description: content["site.description"], alternates: { canonical: "/" } };
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // Started together so the content and character sheet requests add no
  // wait of their own.
  const [
    projects,
    { content, fallback: contentFallback },
    { config: characterConfig, fallback: characterFallback },
    { job: jobParam, stack },
  ] = await Promise.all([
    loadProjects(),
    getContent(),
    getCharacterConfig(),
    searchParams,
  ]);
  const job = resolveJob(characterConfig, jobParam);

  const fallback = contentFallback || characterFallback;

  return (
    // One retry loop for everything that failed. The project list has its
    // own message below: it has no built-in copy, so it says so where the
    // list would be.
    <AutoRetry active={fallback || projects === null}>
      <HomeView
        config={characterConfig}
        job={job}
        content={content}
        projects={projects}
        stack={stack}
        notice={fallback && <FallbackNotice />}
      />
    </AutoRetry>
  );
}
