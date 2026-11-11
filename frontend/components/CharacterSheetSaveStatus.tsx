import type { CharacterSheetFormState } from "@/app/admin/character-sheet/actions";
import { SaveStatus } from "@/components/SaveStatus";
import { StatusMessage } from "@/components/StatusMessage";
import { STACK_PARAM } from "@/lib/character-anchors";

type Props = {
  state: CharacterSheetFormState;
  pending: boolean;
  // Keys in the stored copy that the schema doesn't have (see
  // findUnknownKeys), from before saves refused them. Cleared by a save,
  // which can only succeed without them.
  unknownKeys?: string[];
  // Anchor actions with no section to scroll to (see findDeadAnchors),
  // replaced on save the same way.
  deadAnchors?: string[];
  // Param actions whose parameter the home page doesn't read (see
  // findDeadParams), likewise.
  deadParams?: string[];
};

// What a character sheet save reports, shared by the form and the raw JSON
// editor, which save through the same checks (see actions.ts).
export function CharacterSheetSaveStatus({
  state,
  pending,
  unknownKeys = [],
  deadAnchors = [],
  deadParams = [],
}: Props) {
  const saved = state && "saved" in state ? state : null;
  const problems = state && "problems" in state ? state.problems : undefined;
  // Not repeated under a refused save that already lists every one.
  const storedUnknownKeys =
    saved || unknownKeys.every((key) => problems?.includes(key)) ? [] : unknownKeys;
  const brokenAnchors = saved ? saved.deadAnchors : deadAnchors;
  const unreadParams = saved ? saved.deadParams : deadParams;
  return (
    <>
      {/* The list goes inside the alert, so it's read out with the error. */}
      {state && "error" in state && problems ? (
        <StatusMessage tone="error">
          {state.error}
          <ProblemList items={problems} />
        </StatusMessage>
      ) : (
        <SaveStatus state={state} pending={pending} />
      )}
      {/* Already stored: warned about here, refused by the next save. */}
      {storedUnknownKeys.length > 0 && !pending && (
        <StatusMessage tone="info">
          The saved copy has keys the schema doesn&rsquo;t have (typos?). The next save will be
          refused until they&rsquo;re removed, in the JSON editor if the form doesn&rsquo;t show them:
          <ProblemList items={storedUnknownKeys} />
        </StatusMessage>
      )}
      {/* Saved anyway: the section may be the next edit. */}
      {brokenAnchors.length > 0 && !pending && (
        <StatusMessage tone="info">
          These slots link to a section the home page doesn&rsquo;t show for their job, so clicking
          them goes nowhere. Add the section, or link somewhere else:
          <ProblemList items={brokenAnchors} />
        </StatusMessage>
      )}
      {/* Saved anyway: the package allows any name, for other sites. */}
      {unreadParams.length > 0 && !pending && (
        <StatusMessage tone="info">
          These slots set a query parameter the home page doesn&rsquo;t read, so clicking them only
          changes the address. The home page reads {STACK_PARAM}, which filters the projects by a
          stack tag:
          <ProblemList items={unreadParams} />
        </StatusMessage>
      )}
    </>
  );
}

// The bulleted list inside a StatusMessage: a refused save's problems, or
// the keys, anchors, or params a warning names.
export function ProblemList({ items }: { items: string[] }) {
  return (
    <ul className="json-editor__problems">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
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
