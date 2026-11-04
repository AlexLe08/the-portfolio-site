import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { Sheet } from "@/components/Sheet";
import { StatusMessage } from "@/components/StatusMessage";
import { getSessionToken } from "@/lib/session";

export const metadata = {
  title: "Sign in",
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  // ?expired comes from redirectIfUnauthorized (lib/admin-api.ts): the
  // cookie is still there but the backend rejected it, so bouncing back to
  // /admin would loop.
  const { expired } = await searchParams;
  if (!expired && (await getSessionToken())) redirect("/admin");

  return (
    <Sheet title="Sign in">
      {expired && <StatusMessage tone="info">Your session has expired. Sign in again.</StatusMessage>}
      <LoginForm />
    </Sheet>
  );
}
