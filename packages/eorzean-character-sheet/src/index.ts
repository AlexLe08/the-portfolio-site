// The data side of the package: parsing, loading and job links, with no
// React or CSS, so server code and plain Node scripts can import it. The
// component is in "/react", the zod schemas in "/schema".
export {
  findUnknownKeys,
  loadConfig,
  parseConfig,
  type ConfigSource,
  type LoadIssue,
  type LoadResult,
  type ParseResult,
} from "./parse";
export { actionHref, jobHref, resolveJob } from "./resolve";
export type {
  CharacterSheetConfig,
  Job,
  Portrait,
  SlotAction,
  SlotContent,
  SlotDef,
  SlotPosition,
  Theme,
  Tooltip,
  TooltipItem,
} from "./types";
