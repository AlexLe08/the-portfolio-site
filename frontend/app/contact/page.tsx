import Markdown from "react-markdown";
import { ContactForm } from "@/components/ContactForm";
import { Sheet } from "@/components/Sheet";
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
    <Sheet title="Contact" back={{ href: "/", label: "All projects" }}>
      <div className="intro contact-intro">
        <Markdown>{content["contact.intro"]}</Markdown>
      </div>

      <ContactForm />

      <p className="intro contact-elsewhere">
        You can also find me on{" "}
        <a href={PROFILE_LINKS.github}>GitHub</a> and{" "}
        <a href={PROFILE_LINKS.linkedin}>LinkedIn</a>.
      </p>
    </Sheet>
  );
}
