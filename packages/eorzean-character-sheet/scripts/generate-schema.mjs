// Writes character-sheet.schema.json from schema.ts, so a plain JSON config
// gets autocomplete and validation in editors. Run after changing schema.ts:
//   npm run generate:character-schema
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { characterSheetConfigSchema } from "./schema.ts";

const schema = z.toJSONSchema(characterSheetConfigSchema, { io: "input" });
const out = new URL("./character-sheet.schema.json", import.meta.url);
writeFileSync(out, `${JSON.stringify({ title: "Character sheet config", ...schema }, null, 2)}\n`);
console.log(`wrote ${out.pathname}`);
