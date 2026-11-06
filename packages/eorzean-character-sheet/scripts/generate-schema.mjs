// Writes character-sheet.schema.json from src/schema.ts, so a plain JSON
// config gets autocomplete and validation in editors. Run after changing
// schema.ts (from frontend/, which also copies it to the backend):
//   npm run generate:character-schema
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { characterSheetConfigSchema } from "../src/schema.ts";

// The $id is keyed by the major version: a compatible schema change keeps
// it, a breaking one (a major bump in package.json) changes it.
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const major = pkg.version.split(".")[0];
const id = `https://cdn.jsdelivr.net/npm/${pkg.name}@${major}/character-sheet.schema.json`;

const schema = z.toJSONSchema(characterSheetConfigSchema, { io: "input" });
const out = new URL("../character-sheet.schema.json", import.meta.url);
// Spelling out $schema keeps the order title, $schema, $id; the spread
// fills in the rest without moving those keys.
const doc = { title: "Character sheet config", $schema: schema.$schema, $id: id, ...schema };
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`wrote ${out.pathname}`);
