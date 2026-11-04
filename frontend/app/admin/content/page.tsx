import { updateContent } from "./actions";
import { ContentField } from "@/components/ContentField";
import { Sheet } from "@/components/Sheet";
import { adminLoad } from "@/lib/admin-api";
import { FALLBACK_CONTENT, type ContentKey } from "@/lib/content";

export const metadata = {
  title: "Site content",
};

// Typed against ContentKey, so adding a key to lib/content.ts without
// describing it here fails the build.
const DESCRIPTIONS: Record<ContentKey, string> = {
  "site.description": "Search-result and link-preview description",
  "home.role": "Positioning line under your name on the home page",
  "home.fact.role": "Home page fact: role",
  "home.fact.location": "Home page fact: location",
  "home.fact.status": "Home page fact: availability",
  "home.intro": "Home page introduction above the projects",
  "contact.intro": "Contact page introduction above the form",
};

export default async function AdminContentPage() {
  // Not getContent(): it falls back to built-in text after 5 seconds, and
  // saving a fallback shown during a cold start would overwrite real copy.
  // Here a slow or failed load waits or shows app/admin/error.tsx instead.
  const stored = await adminLoad("content", (api) => api.GET("/content"));

  // Only keys the site reads: editing any other key would change nothing.
  const keys = Object.keys(FALLBACK_CONTENT) as ContentKey[];

  return (
    <Sheet title="Site content" back={{ href: "/admin", label: "Admin" }}>
      {keys.map((key) => (
        <ContentField
          key={key}
          action={updateContent.bind(null, key)}
          contentKey={key}
          description={DESCRIPTIONS[key]}
          value={stored[key] ?? FALLBACK_CONTENT[key]}
          fallback={FALLBACK_CONTENT[key]}
          isSet={key in stored}
        />
      ))}
    </Sheet>
  );
}
