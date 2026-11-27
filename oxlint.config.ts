import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import vitest from "ultracite/oxlint/vitest";

const HOVER_THROUGH_TARGET =
  "React skips it when the pointer comes from another React tree: use shell/hover-target.ts.";

export default defineConfig({
  extends: [core, react, tanstack, antiSlop],
  ignorePatterns: ["**/routeTree.gen.ts"],
  options: { typeAware: true },
  overrides: [
    ...(vitest.overrides ?? []),
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      plugins: ["vitest"],
      rules: {
        "no-restricted-imports": "off",
        "react/no-clone-element": "off",
        "require-await": "off",
        "typescript/no-non-null-assertion": "off",
        "vitest/max-expects": "off",
        "vitest/require-top-level-describe": "off",
      },
    },
    {
      files: ["packages/retouche/src/server/deferred.ts"],
      rules: { "promise/avoid-new": "off" },
    },
  ],
  rules: {
    "func-style": "off",
    "import/consistent-type-specifier-style": "off",
    "jsx-a11y/prefer-tag-over-role": "off",
    "max-depth": ["error", { max: 3 }],
    "max-lines": [
      "error",
      { max: 400, skipBlankLines: true, skipComments: true },
    ],
    "max-lines-per-function": [
      "error",
      { IIFEs: true, max: 50, skipBlankLines: true, skipComments: true },
    ],
    "max-params": ["error", { max: 3 }],
    "no-await-in-loop": "off",
    "no-empty-function": ["error", { allow: ["arrowFunctions"] }],
    "no-plusplus": "off",
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            importNames: ["forwardRef", "memo", "useCallback", "useMemo"],
            message:
              "React 19: pass ref as a prop and compute inline; no memoization.",
            name: "react",
          },
        ],
      },
    ],
    "no-shadow": "off",
    "no-use-before-define": ["error", { functions: false }],
    "no-warning-comments": [
      "error",
      {
        location: "start",
        terms: ["todo", "fixme", "xxx", "oxlint-disable", "eslint-disable"],
      },
    ],
    "prefer-arrow-callback": ["error", { allowNamedFunctions: true }],
    "prefer-destructuring": "off",
    "react/forbid-dom-props": [
      "error",
      {
        forbid: ["onMouseEnter", "onPointerEnter"].map((propName) => ({
          message: HOVER_THROUGH_TARGET,
          propName,
        })),
      },
    ],
    "react/function-component-definition": "off",
    "react/jsx-handler-names": "off",
    "require-unicode-regexp": "off",
    "typescript/ban-ts-comment": [
      "error",
      { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true },
    ],
    "typescript/consistent-return": "off",
    "typescript/consistent-type-assertions": [
      "error",
      { assertionStyle: "never" },
    ],
    "typescript/no-deprecated": [
      "error",
      { allow: [{ from: "lib", name: "keyCode" }] },
    ],
    "typescript/no-restricted-types": [
      "error",
      { types: { ReturnType: "Name the type instead." } },
    ],
    "unicorn/import-style": "off",
    "unicorn/prefer-number-coercion": "off",
  },
});
