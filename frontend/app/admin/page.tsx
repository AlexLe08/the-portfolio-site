import Link from "next/link";
import { logout } from "./actions";
import { adminApi, redirectIfUnauthorized } from "@/lib/admin-api";

export const metadata = {
  title: "Admin — Alexander Le",
};

export default async function AdminPage() {
  const api = await adminApi();
  const { data: projects, response } = await api.GET("/admin/projects");
  redirectIfUnauthorized(response);
  // Shown by app/admin/error.tsx. A network failure throws on its own.
  if (!projects) throw new Error(`Loading projects failed (HTTP ${response.status})`);

  return (
    <main className="sheet">
      <div className="prose-width">
        <header className="detail-header">
          <h1 className="detail-header__title">Admin</h1>
        </header>

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

        <form action={logout} className="form-actions">
          <button type="submit" className="form-button">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
