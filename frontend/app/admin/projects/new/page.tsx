import { createProject } from "../actions";
import { ProjectForm } from "@/components/ProjectForm";
import { Sheet } from "@/components/Sheet";
import { verifySession } from "@/lib/session";

export const metadata = {
  title: "New project",
};

export default async function NewProjectPage() {
  await verifySession();

  return (
    <Sheet title="New project" back={{ href: "/admin", label: "All projects" }}>
      <ProjectForm action={createProject} />
    </Sheet>
  );
}
