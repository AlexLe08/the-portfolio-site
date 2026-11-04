import Link from "next/link";
import { updateProject } from "../actions";
import { ProjectForm } from "@/components/ProjectForm";
import { Sheet } from "@/components/Sheet";
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
    <Sheet
      title={project.title}
      back={{ href: "/admin", label: "All projects" }}
      header={
        <p className="admin-table__slug">
          {project.published ? (
            <Link href={`/projects/${project.slug}`}>/projects/{project.slug}</Link>
          ) : (
            <>/projects/{project.slug} (draft, not on the site yet)</>
          )}
        </p>
      }
    >
      {/* bind fixes the slug as the action's first argument. It isn't a
          secret, and updateProject still checks the session itself. */}
      <ProjectForm action={updateProject.bind(null, project.slug)} project={project} />
    </Sheet>
  );
}
