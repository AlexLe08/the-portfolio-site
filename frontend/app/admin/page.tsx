import { logout } from "./actions";
import { verifySession } from "@/lib/session";

export const metadata = {
  title: "Admin — Alexander Le",
};

export default async function AdminPage() {
  await verifySession();

  return (
    <main className="sheet">
      <div className="prose-width">
        <header className="detail-header">
          <h1 className="detail-header__title">Admin</h1>
        </header>

        <p className="intro">
          Signed in. Screens for editing projects and site content come next.
        </p>

        <form action={logout} className="form-actions">
          <button type="submit" className="form-button">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
