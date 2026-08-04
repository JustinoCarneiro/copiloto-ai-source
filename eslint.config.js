import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // supabase/functions roda em Deno (imports "npm:"/"https://deno.land/...", globals de Deno,
  // sem tsconfig do projeto) — não é código do app Vite/React, não deve ser lintado com esta config.
  { ignores: ["dist", "supabase/functions"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Débito técnico pré-existente: 150 usos de `any` em src/ (queries/mutations do TanStack
      // Query, principalmente). Rebaixado pra warn (não bloqueia CI) até serem tipados com
      // src/integrations/supabase/types.ts módulo a módulo — ver memoria-tecnica/decisoes/
      // e ROADMAP.md. Não silenciar totalmente: a contagem deve aparecer no output do lint.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
