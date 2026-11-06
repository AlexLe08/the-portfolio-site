// The data side of the package: parsing, loading, job links and the
// config's limits, with no React or CSS, so server code and plain Node
// scripts can import it. The component is in "/react", the zod schema in
// "/schema".
export {
  findUnknownKeys,
  loadConfig,
  parseConfig,
  type ConfigSource,
  type LoadIssue,
  type LoadResult,
  type ParseResult,
} from "./parse";
export { ID_PATTERN, LIMITS } from "./schema";
export { actionHref, jobHref, publicConfig, resolveJob } from "./resolve";
export type {
  CharacterSheetConfig,
  Job,
  JobStatus,
  Portrait,
  SlotAction,
  SlotContent,
  SlotDef,
  SlotPosition,
  Theme,
  Tooltip,
  TooltipItem,
} from "./types";
