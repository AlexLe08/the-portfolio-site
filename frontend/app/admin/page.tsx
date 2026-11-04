import Link from "next/link";
import { logout } from "./actions";
import { Sheet } from "@/components/Sheet";
import { adminLoad } from "@/lib/admin-api";

export default async function AdminPage() {
  const projects = await adminLoad("projects", (api) => api.GET("/admin/projects"));

  return (
    <Sheet title="Admin">
      <div className="admin-toolbar">
        <h2 className="admin-heading">Projects</h2>
        <Link href="/admin/projects/new">New project</Link>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Project</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.slug}>
              <td className="admin-table__order">{project.sort_order}</td>
              <td>
                <Link href={`/admin/projects/${project.slug}`}>{project.title}</Link>
                <div className="admin-table__slug">{project.slug}</div>
              </td>
              <td className={project.published ? undefined : "admin-table__draft"}>
                {project.published ? "Published" : "Draft"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="admin-toolbar admin-toolbar--section">
        <h2 className="admin-heading">Site content</h2>
        <Link href="/admin/content">Edit site content</Link>
      </div>

      <div className="admin-toolbar admin-toolbar--section">
        <h2 className="admin-heading">Character sheet</h2>
        <Link href="/admin/character-sheet">Edit character sheet</Link>
      </div>

      <div className="admin-toolbar admin-toolbar--section">
        <h2 className="admin-heading">Media</h2>
        <Link href="/admin/media">Upload images</Link>
      </div>

      <form action={logout} className="form-actions">
        <button type="submit" className="form-button">
          Sign out
        </button>
      </form>
    </Sheet>
  );
}
