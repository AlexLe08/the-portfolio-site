import { defineConfig } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// The package's boundary: it imports nothing but react and zod, so it can
// move to its own repository unchanged. A tsconfig can't enforce this (a
// host's `paths` apply to the package when the host compiles it), so lint
// does. The host runs this config through its own lint script.
const IMPORT_MESSAGE =
  "The character sheet package imports only react, zod and its own files (./…).";
// Each entry must match the whole specifier. "./" paths may not climb out
// with "..".
const ALLOWED = ["react", "react/.+", "zod", String.raw`\./(?!.*\.\.).+`];
const SCRIPT_ALLOWED = [...ALLOWED, "node:.+", String.raw`\.\./src/(?!.*\.\.).+`];
const TEST_ALLOWED = [...ALLOWED, "vitest"];
const onlyAllowed = (list) => `^(?!(${list.join("|")})$)`;

export default defineConfig([
  tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  { settings: { react: { version: "detect" } } },
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    // Everything but this file, which imports the lint tooling.
    ignores: ["eslint.config.mjs"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: onlyAllowed(ALLOWED), message: IMPORT_MESSAGE }] },
      ],
    },
  },
  {
    // The schema generator runs in plain Node and reads the source.
    files: ["scripts/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: onlyAllowed(SCRIPT_ALLOWED),
              message: "Scripts may also import node: modules and ../src/….",
            },
          ],
        },
      ],
    },
  },
  {
    // Tests run under vitest and never ship.
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: onlyAllowed(TEST_ALLOWED), message: "Tests may also import vitest." }] },
      ],
    },
  },
]);
