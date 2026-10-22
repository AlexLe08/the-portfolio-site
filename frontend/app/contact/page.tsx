import Link from "next/link";
import Markdown from "react-markdown";
import { ContactForm } from "@/components/ContactForm";
import { getContent } from "@/lib/content";
import { PROFILE_LINKS } from "@/lib/links";

// The intro comes from the backend and can change any time via the admin API.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact",
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

        <p className="intro" style={{ marginTop: "2rem" }}>
          You can also find me on{" "}
          <a href={PROFILE_LINKS.github}>GitHub</a> and{" "}
          <a href={PROFILE_LINKS.linkedin}>LinkedIn</a>.
        </p>
      </div>
    </main>
  );
}
