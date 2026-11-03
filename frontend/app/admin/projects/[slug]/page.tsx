import Link from "next/link";
import { updateProject } from "../actions";
import { ProjectForm } from "@/components/ProjectForm";
import { adminLoad } from "@/lib/admin-api";

export const metadata = {
  title: "Edit project",
};

export default async function EditProjectPage({ params }: PageProps<"/admin/projects/[slug]">) {
  const { slug } = await params;
  const project = await adminLoad(
    "the project",
    (api) => api.GET("/admin/projects/{slug}", { params: { path: { slug } } }),
    { notFoundOn404: true },
  );

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
