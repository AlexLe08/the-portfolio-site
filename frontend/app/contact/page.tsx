import Markdown from "react-markdown";
import { AutoRetry } from "@/components/AutoRetry";
import { ContactForm } from "@/components/ContactForm";
import { FallbackNotice } from "@/components/FallbackNotice";
import { Sheet } from "@/components/Sheet";
import { getContent } from "@/lib/content";
import { PROFILE_LINKS } from "@/lib/links";

// The intro comes from the backend and can change any time via the admin API.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact",
};

export default async function ContactPage() {
  const { content, fallback } = await getContent();

  return (
    <AutoRetry active={fallback}>
      <Sheet
        title="Contact"
        back={{ href: "/", label: "All projects" }}
        notice={fallback && <FallbackNotice />}
      >
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
    </AutoRetry>
  );
}
