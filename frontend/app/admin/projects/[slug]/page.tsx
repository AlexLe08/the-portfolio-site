import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProject } from "../actions";
import { ProjectForm } from "@/components/ProjectForm";
import { adminApi, redirectIfUnauthorized } from "@/lib/admin-api";

export const metadata = {
  title: "Edit project — Admin",
};

export default async function EditProjectPage({ params }: PageProps<"/admin/projects/[slug]">) {
  const { slug } = await params;
  const api = await adminApi();
  const { data: project, response } = await api.GET("/admin/projects/{slug}", {
    params: { path: { slug } },
  });
  redirectIfUnauthorized(response);
  if (response.status === 404) notFound();
  if (!project) throw new Error(`Loading the project failed (HTTP ${response.status})`);

  return (
    <main className="sheet">
      <div className="prose-width">
        <Link href="/admin" className="back-link">
          All projects
        </Link>

        <header className="detail-header">
          <h1 className="detail-header__title">{project.title}</h1>
          <p className="admin-table__slug">
            {project.published ? (
              <Link href={`/projects/${project.slug}`}>/projects/{project.slug}</Link>
            ) : (
              <>/projects/{project.slug} (draft, not on the site yet)</>
            )}
          </p>
        </header>

        {/* bind fixes the slug as the action's first argument. It isn't a
            secret, and updateProject still checks the session itself. */}
        <ProjectForm action={updateProject.bind(null, project.slug)} project={project} />
      </div>
    </main>
  );
}
