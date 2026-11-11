import type { ReactNode } from "react";
import { Sheet } from "@/components/Sheet";
import { StatusMessage } from "@/components/StatusMessage";

// What every error boundary shows: its message and a "Try again" button
// that calls the boundary's retry(). Only client boundaries import it, so
// it runs as a client component without its own directive.
export function ErrorNotice({ message, retry }: { message: ReactNode; retry: () => void }) {
  return (
    <Sheet>
      <StatusMessage tone="error">{message}</StatusMessage>
      <button type="button" className="form-button" onClick={() => retry()}>
        Try again
      </button>
    </Sheet>
  );
}
