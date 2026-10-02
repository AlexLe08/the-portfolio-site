import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";

export const metadata = {
  title: "Contact — Alexander Le",
};

export default function ContactPage() {
  return (
    <main className="sheet">
      <div className="prose-width">
        <Link href="/" className="back-link">
          All projects
        </Link>

        <header className="detail-header">
          <h1 className="detail-header__title">Contact</h1>
        </header>

        <ContactForm />
      </div>
    </main>
  );
}