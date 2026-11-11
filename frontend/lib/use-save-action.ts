import { startTransition, useActionState, type FormEvent } from "react";

// What an admin save action returns: an error to show, or what was saved.
export type SaveState = { error: string } | { saved: unknown } | null;

// The Server Action an admin editor takes, as useActionState calls it.
export type SaveAction<S> = (state: S, formData: FormData) => Promise<S>;

// useActionState for admin editors, submitted through onSubmit rather than
// the form's action prop. React resets a form after its action prop runs,
// even when the server rejects the save, which would wipe a long edit.
// Only for client components.
export function useSaveAction<State extends SaveState>(action: SaveAction<State>) {
  // Every SaveState allows null, which means "nothing submitted yet".
  // Awaited<State> is how useActionState types it; for these plain object
  // states it's the same type.
  const [state, formAction, pending] = useActionState(action, null as Awaited<State>);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return { state, pending, onSubmit };
}
