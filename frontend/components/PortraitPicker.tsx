"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// The fields of an upload the picker shows (MediaRead from /admin/media).
export type PortraitUpload = { url: string; alt_text: string; width: number; height: number };

type Props = {
  // Newest first. null: loading them failed, so only a pasted URL is offered.
  uploads: PortraitUpload[] | null;
  src: string;
  alt: string;
  srcMaxLength?: number;
  altMaxLength?: number;
};

const NONE = "none";
const PASTED = "pasted";

// Picks the portrait from the uploads at /admin/media, a pasted URL, or
// none. Whichever it is goes out as one hidden portrait_src, the same field
// the URL input used to send, so updateCharacterJob doesn't know the
// difference. Picking an upload fills in its alt text unless the alt text
// was written by hand.
export function PortraitPicker({ uploads, src, alt: initialAlt, srcMaxLength, altMaxLength }: Props) {
  const list = uploads ?? [];
  // An upload's URL, NONE, or PASTED. Uploads are Cloudinary URLs, so they
  // can't collide with the two names.
  const [choice, setChoice] = useState(() =>
    !src ? NONE : list.some((upload) => upload.url === src) ? src : PASTED,
  );
  const [pasted, setPasted] = useState(choice === PASTED ? src : "");
  const [alt, setAlt] = useState(initialAlt);

  const altOf = (url: string) => list.find((upload) => upload.url === url)?.alt_text;
  function choose(next: string) {
    const fill = altOf(next);
    if (fill !== undefined && (!alt.trim() || alt === altOf(choice))) setAlt(fill);
    setChoice(next);
  }
  const submitted = choice === NONE ? "" : choice === PASTED ? pasted : choice;

  // The radios share a name so arrow keys move between them; the action
  // reads only portrait_src.
  const radio = (value: string, id: string) => (
    <input
      type="radio"
      id={id}
      name="portrait_choice"
      value={value}
      checked={choice === value}
      onChange={() => choose(value)}
    />
  );

  return (
    <>
      <input type="hidden" name="portrait_src" value={submitted} />
      <fieldset className="form-field portrait-picker" aria-describedby="portrait-picker-help">
        <legend className="form-label">Image</legend>
        <div className="form-check">
          {radio(NONE, "portrait-none")}
          <label htmlFor="portrait-none">No portrait</label>
        </div>

        {list.length > 0 && (
          <ul className="portrait-picker__uploads">
            {list.map((upload, index) => (
              <li key={upload.url}>
                <label className="portrait-picker__upload">
                  {radio(upload.url, `portrait-upload-${index}`)}
                  {/* The caption below names the image. */}
                  <Image src={upload.url} alt="" width={upload.width} height={upload.height} sizes="7rem" />
                  <span className="portrait-picker__caption">
                    {upload.alt_text || "No alt text"}
                    <span className="portrait-picker__size">
                      {upload.width} × {upload.height}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="form-check portrait-picker__pasted">
          {radio(PASTED, "portrait-pasted")}
          <label htmlFor="portrait-pasted">Image URL</label>
          <input
            aria-label="Image URL"
            value={pasted}
            maxLength={srcMaxLength}
            onChange={(event) => {
              setPasted(event.target.value);
              if (choice !== PASTED) choose(PASTED);
            }}
            className="form-input"
          />
        </div>

        <p id="portrait-picker-help" className="form-help">
          {uploads === null
            ? "Your uploads couldn't be loaded, so only a URL can be used. Reload to try again. "
            : list.length === 0
              ? "Nothing uploaded yet. "
              : null}
          Upload images at <Link href="/admin/media">Media</Link>. No portrait removes it, alt text
          included.
        </p>
      </fieldset>

      <div className="form-field">
        <label htmlFor="portrait_alt" className="form-label">
          Alt text
        </label>
        <input
          id="portrait_alt"
          name="portrait_alt"
          maxLength={altMaxLength}
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          aria-describedby="portrait-alt-help"
          className="form-input"
        />
        <p id="portrait-alt-help" className="form-help">
          Picking an upload fills in its alt text, unless you&rsquo;ve written your own.
        </p>
      </div>
    </>
  );
}
