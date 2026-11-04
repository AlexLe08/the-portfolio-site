import { StatusMessage } from "@/components/StatusMessage";
import type { SaveState } from "@/lib/use-save-action";

// The result line under an admin editor (see useSaveAction). "Saved." is
// hidden while a new save is pending, so it never describes a stale save.
export function SaveStatus({ state, pending }: { state: SaveState; pending: boolean }) {
  if (state && "error" in state) {
    return <StatusMessage tone="error">{state.error}</StatusMessage>;
  }
  if (state && "saved" in state && !pending) {
    return <StatusMessage tone="success">Saved.</StatusMessage>;
  }
  return null;
}
