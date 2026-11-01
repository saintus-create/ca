import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Lint the code this project owns.
 *
 * components/ui is shadcn/Radix and components/velora is a vendored animated
 * component set: both are third-party source, and linting them produces
 * thousands of findings nobody here can act on. Generated declarations are
 * excluded for the same reason. Application code is linted with no exemptions.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "components/ui/**",
      "components/velora/**",
      "public/corpus/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Unused values are errors, not noise: they are how dead code accumulates.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
