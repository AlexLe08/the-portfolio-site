import Image from "next/image";
import Link from "next/link";
import { MediaUploadForm } from "@/components/MediaUploadForm";
import { adminApi, redirectIfUnauthorized } from "@/lib/admin-api";

export const metadata = {
  title: "Media",
};

// Images are used as markdown in site content for now, so each upload
// offers that line ready to paste. "]" would end the alt text early.
function markdownFor(altText: string, url: string) {
  return `![${altText.replaceAll("]", "\\]")}](${url})`;
}

export default async function AdminMediaPage() {
  const api = await adminApi();
  const { data: media, response } = await api.GET("/admin/media");
  redirectIfUnauthorized(response);
  // Shown by app/admin/error.tsx. A network failure throws on its own.
  if (!media) throw new Error(`Loading media failed (HTTP ${response.status})`);

  return (
    <main className="sheet">
      <div className="prose-width">
        <Link href="/admin" className="back-link">
          Admin
        </Link>

        <header className="detail-header">
          <h1 className="detail-header__title">Media</h1>
        </header>

        <MediaUploadForm />

        <h2 className="admin-heading admin-toolbar--section">Uploads</h2>
        {media.length === 0 ? (
          <p className="form-help">Nothing uploaded yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Image</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {media.map((item) => (
                <tr key={item.id}>
                  <td className="admin-table__thumb">
                    <a href={item.url}>
                      <Image
                        src={item.url}
                        alt={item.alt_text}
                        width={item.width}
                        height={item.height}
                        sizes="10rem"
                      />
                    </a>
                  </td>
                  <td>
                    {item.alt_text}
                    <div className="admin-table__slug">
                      {item.width} × {item.height}, {Math.round(item.size_bytes / 1024)} KB
                    </div>
                    <label htmlFor={`markdown-${item.id}`} className="form-label media-markdown__label">
                      Markdown
                    </label>
                    <input
                      id={`markdown-${item.id}`}
                      readOnly
                      value={markdownFor(item.alt_text, item.url)}
                      className="form-input media-markdown"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
