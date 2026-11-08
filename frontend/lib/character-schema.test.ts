import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// The backend validates admin saves against its own copy of the package's
// JSON Schema. These checks live here, not in backend tests, because only
// the frontend installs the package.
const require = createRequire(import.meta.url);
const PACKAGE_SCHEMA = require.resolve("@solution-nine/wol-character-panel/character-sheet.schema.json");
const PACKAGE_VERSION: string = require("@solution-nine/wol-character-panel/package.json").version;
const BACKEND_SCHEMA = new URL("../../backend/app/services/character_sheet.schema.json", import.meta.url);

describe("backend's copy of the character sheet schema", () => {
  it("matches the installed package's", () => {
    // Fails after a package upgrade without `npm run generate:character-schema`.
    expect(readFileSync(BACKEND_SCHEMA)).toEqual(readFileSync(PACKAGE_SCHEMA));
  });

  it("has an $id pinned to the installed major version", () => {
    // The package's README promises this URL, so other tools can fetch the
    // schema. The schema has no $refs (zod inlines everything), so an
    // absolute $id doesn't change how the backend's validation resolves.
    const schema = JSON.parse(readFileSync(BACKEND_SCHEMA, "utf8"));
    const match = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@solution-nine\/wol-character-panel@(\d+)\/character-sheet\.schema\.json$/.exec(
      schema.$id,
    );

    expect(match).not.toBeNull();
    // A major version upgrade without copying the schema would leave the old @N.
    expect(match![1]).toBe(PACKAGE_VERSION.split(".")[0]);
  });
});
