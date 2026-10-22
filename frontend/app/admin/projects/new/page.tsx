import Link from "next/link";
import { createProject } from "../actions";
import { ProjectForm } from "@/components/ProjectForm";
import { verifySession } from "@/lib/session";

export const metadata = {
  title: "New project — Admin",
};

export default async function NewProjectPage() {
  await verifySession();

  return (
    <main className="sheet">
      <div className="prose-width">
        <Link href="/admin" className="back-link">
          All projects
        </Link>

        <header className="detail-header">
          <h1 className="detail-header__title">New project</h1>
        </header>

        <ProjectForm action={createProject} />
      </div>
    </main>
  );
}
