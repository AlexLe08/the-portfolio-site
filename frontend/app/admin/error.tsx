"use client"; // Error boundaries must be client components.

// Catches failures while an admin page loads (backend down, unexpected
// status). retry() re-renders the segment, which fetches again.
export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="sheet">
      <div className="prose-width">
        <div className="form-status form-status--error" role="alert">
          Couldn&rsquo;t load from the server. It may be waking up, so try again in a minute.
        </div>
        <button type="button" className="form-button" onClick={() => retry()}>
          Try again
        </button>
      </div>
    </main>
  );
}
