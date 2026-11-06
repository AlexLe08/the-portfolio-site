import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import { SaveStatus } from "@/components/SaveStatus";
import { StatusMessage } from "@/components/StatusMessage";

type Props = {
  state: CharacterSheetFormState;
  pending: boolean;
  // Keys in the stored copy that the schema doesn't have (see
  // findUnknownKeys); a save replaces them with its own list.
  unknownKeys: string[];
  // Anchor actions with no section to scroll to (see findDeadAnchors),
  // replaced on save the same way.
  deadAnchors: string[];
};

// What a character sheet save reports, shared by the form and the raw JSON
// editor, which save through the same checks (see actions.ts).
export function CharacterSheetSaveStatus({ state, pending, unknownKeys, deadAnchors }: Props) {
  const saved = state && "saved" in state ? state : null;
  const ignoredKeys = saved ? saved.unknownKeys : unknownKeys;
  const brokenAnchors = saved ? saved.deadAnchors : deadAnchors;
  return (
    <>
      {/* The list goes inside the alert, so it's read out with the error. */}
      {state && "problems" in state && state.problems ? (
        <StatusMessage tone="error">
          {state.error}
          <ul className="json-editor__problems">
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </StatusMessage>
      ) : (
        <SaveStatus state={state} pending={pending} />
      )}
      {/* Saved anyway: the panel just leaves these out (see actions.ts). */}
      {ignoredKeys.length > 0 && !pending && (
        <StatusMessage tone="info">
          The site ignores these keys, which the schema doesn&rsquo;t have. Typos?
          <ul className="json-editor__problems">
            {ignoredKeys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </StatusMessage>
      )}
      {/* Saved anyway too: the section may be the next edit. */}
      {brokenAnchors.length > 0 && !pending && (
        <StatusMessage tone="info">
          These slots link to a section the home page doesn&rsquo;t show for their job, so clicking
          them goes nowhere. Add the section, or link somewhere else:
          <ul className="json-editor__problems">
            {brokenAnchors.map((anchor) => (
              <li key={anchor}>{anchor}</li>
            ))}
          </ul>
        </StatusMessage>
      )}
    </>
  );
}

// How the copy the site shows compares with lib/character-config.json.
// Both are compact JSON; stored is null before the first save. The JSON
// editor's page isn't re-fetched after a save, so pass what was just saved.
export function describeStoredCopy(stored: string | null, bundled: string): string | undefined {
  if (stored === null) {
    return "Not saved yet: the site shows lib/character-config.json, which this starts from.";
  }
  if (stored !== bundled) {
    return "Differs from lib/character-config.json, which shows during outages. Update it there too.";
  }
}
