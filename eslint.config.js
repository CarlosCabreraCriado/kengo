// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = tseslint.config(
  {
    files: ["apps/**/*.ts", "libs/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: ["app", "web", "ui", "ui2"],
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: ["app", "web", "ui", "ui2"],
          style: "kebab-case",
        },
      ],
    },
  },
  {
    files: ["apps/**/*.html", "libs/**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  },
  {
    // Guardrail B1: bloquea imports runtime de deps server-only (Convex) y del
    // SDK de Firebase desde el código del frontend. `import type` está
    // permitido (allowTypeImports) — el shim de tipos en
    // apps/app/src/types/pdfkit-standalone.d.ts lo aprovecha. Las funciones
    // FCM web pasan por `@capacitor-firebase/messaging`, no por `firebase/*`.
    files: ["apps/app/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "stripe", message: "stripe es server-only (Convex). No importar desde Angular.", allowTypeImports: true },
            { name: "resend", message: "resend es server-only (Convex).", allowTypeImports: true },
            { name: "google-auth-library", message: "google-auth-library es server-only (Convex).", allowTypeImports: true },
            { name: "pdfkit", message: "pdfkit es server-only (Convex).", allowTypeImports: true },
            { name: "firebase", message: "Usar @capacitor-firebase/messaging; no importar el SDK de firebase directamente.", allowTypeImports: true },
          ],
          patterns: [
            { group: ["@aws-sdk/*"], message: "AWS SDK es server-only (Convex / R2).", allowTypeImports: true },
            { group: ["pdfkit/*"], message: "pdfkit es server-only (Convex).", allowTypeImports: true },
            { group: ["firebase/*"], message: "Usar @capacitor-firebase/messaging; no importar el SDK de firebase directamente.", allowTypeImports: true },
          ],
        },
      ],
    },
  }
);
