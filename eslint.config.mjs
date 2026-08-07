import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // `supabase start` drops Deno edge-runtime sources into supabase/.temp. They
  // are git-ignored but ESLint still walked them, drowning real findings in
  // ~150 errors from vendored code nobody edits.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "test-results/**",
    "supabase/.temp/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
