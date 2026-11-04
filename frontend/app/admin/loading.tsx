import { Sheet } from "@/components/Sheet";

// Shown while an admin page waits on the backend. Render's free tier takes
// 30-50s to wake, so say so rather than leave a blank page.
export default function AdminLoading() {
  return (
    <Sheet>
      <p className="intro" role="status">
        Loading. If the server is asleep, this can take up to a minute.
      </p>
    </Sheet>
  );
}
