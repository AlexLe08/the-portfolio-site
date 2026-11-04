import type { Metadata } from "next";
import { CharacterSheet } from "@/components/character-sheet/CharacterSheet";
import { resolveJob } from "@/components/character-sheet/resolve";
import { Sheet } from "@/components/Sheet";
import { characterConfig } from "@/lib/character";
import { renderLink, renderPortrait } from "@/lib/character-render";

// A showcase and test bed for the character sheet's themes: the home page's
// config, drawn in both. Not linked from the site and not indexed.
export const metadata: Metadata = {
  title: "Character sheet themes",
  robots: { index: false, follow: false },
};

const BASE_PATH = "/lab/character-sheet";

export default async function CharacterSheetLabPage({ searchParams }: PageProps<"/lab/character-sheet">) {
  const job = resolveJob(characterConfig, (await searchParams).job);
  const shared = {
    config: characterConfig,
    job,
    basePath: BASE_PATH,
    renderLink,
    renderPortrait,
    showSockets: true,
    showToolbar: true,
  };

  return (
    <Sheet title="Character sheet themes" back={{ href: "/", label: "Home" }}>
      <p className="intro lab-intro">
        The home page&rsquo;s character sheet in each of its themes. Changing the job in either
        panel changes both.
      </p>

      <div className="section-rule">
        <h2 className="section-rule__label">Document theme</h2>
      </div>
      <CharacterSheet {...shared} theme="document" label="Character sheet, document theme" />

      <div className="section-rule">
        <h2 className="section-rule__label">Game theme</h2>
      </div>
      <CharacterSheet {...shared} theme="game" label="Character sheet, game theme" />
    </Sheet>
  );
}
