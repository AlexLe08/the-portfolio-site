import type { SaveState } from "@/lib/use-save-action";

// The result line under an admin editor (see useSaveAction). "Saved." is
// hidden while a new save is pending, so it never describes a stale save.
export function SaveStatus({ state, pending }: { state: SaveState; pending: boolean }) {
  if (state && "error" in state) {
    return (
      <div className="form-status form-status--error" role="alert">
        {state.error}
      </div>
    );
  }
  if (state && "saved" in state && !pending) {
    return (
      <div className="form-status form-status--success" role="status">
        Saved.
      </div>
    );
  }
  return null;
}
