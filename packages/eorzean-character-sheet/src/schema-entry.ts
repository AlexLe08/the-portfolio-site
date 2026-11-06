// The "/schema" entry: the whole config's zod schema, for hosts that
// validate with zod themselves. Its parts stay internal, so they can change
// shape without breaking anyone; limits are plain values in LIMITS (".").
export { characterSheetConfigSchema } from "./schema";
