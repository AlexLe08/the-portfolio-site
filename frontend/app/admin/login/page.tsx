import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSessionToken } from "@/lib/session";

export const metadata = {
  title: "Sign in — Admin",
};

export default async function AdminLoginPage() {
  if (await getSessionToken()) redirect("/admin");

  return (
    <main className="sheet">
      <div className="prose-width">
        <header className="detail-header">
          <h1 className="detail-header__title">Sign in</h1>
        </header>

        <LoginForm />
      </div>
    </main>
  );
}
