import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSessionToken } from "@/lib/session";

export const metadata = {
  title: "Sign in — Admin",
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  // ?expired comes from redirectIfUnauthorized (lib/admin-api.ts): the
  // cookie is still there but the backend rejected it, so bouncing back to
  // /admin would loop.
  const { expired } = await searchParams;
  if (!expired && (await getSessionToken())) redirect("/admin");

  return (
    <main className="sheet">
      <div className="prose-width">
        <header className="detail-header">
          <h1 className="detail-header__title">Sign in</h1>
        </header>

        {expired && (
          <div className="form-status" role="status">
            Your session has expired. Sign in again.
          </div>
        )}

        <LoginForm />
      </div>
    </main>
  );
}
