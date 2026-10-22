import { startTransition, useActionState, type FormEvent } from "react";

// What an admin save action returns: an error to show, or what was saved.
export type SaveState = { error: string } | { saved: unknown } | null;

// useActionState for admin editors, submitted through onSubmit rather than
// the form's action prop. React resets a form after its action prop runs,
// even when the server rejects the save, which would wipe a long edit.
// Only for client components (ProjectForm, ContentField).
export function useSaveAction<State extends SaveState>(
  // Awaited<State> because that's how useActionState types it; for these
  // plain object states it's the same type.
  action: (state: Awaited<State>, formData: FormData) => Promise<State>,
) {
  // Every SaveState allows null, which means "nothing submitted yet".
  const [state, formAction, pending] = useActionState(action, null as Awaited<State>);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return { state, pending, onSubmit };
}
