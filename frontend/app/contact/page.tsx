import Link from "next/link";
import Markdown from "react-markdown";
import { ContactForm } from "@/components/ContactForm";
import { getContent } from "@/lib/content";

// The intro comes from the backend and can change any time via the admin API.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact — Alexander Le",
};

export default async function ContactPage() {
  const content = await getContent();

  return (
    <main className="sheet">
      <div className="prose-width">
        <Link href="/" className="back-link">
          All projects
        </Link>

        <header className="detail-header">
          <h1 className="detail-header__title">Contact</h1>
        </header>

        <div className="intro" style={{ marginBottom: "2rem" }}>
          <Markdown>{content["contact.intro"]}</Markdown>
        </div>

        <ContactForm />
      </div>
    </main>
  );
}
