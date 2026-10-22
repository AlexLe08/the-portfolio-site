// Shown while an admin page waits on the backend. Render's free tier takes
// 30-50s to wake, so say so rather than leave a blank page.
export default function AdminLoading() {
  return (
    <main className="sheet">
      <div className="prose-width">
        <p className="intro" role="status">
          Loading. If the server is asleep, this can take up to a minute.
        </p>
      </div>
    </main>
  );
}
