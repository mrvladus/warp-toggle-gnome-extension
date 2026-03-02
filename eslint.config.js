import json from "@eslint/json";

export default [
  {
    files: ["metadata.json"],
    language: "json/json",
    ...json.configs.recommended,
  },
  {
    files: ["extension.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
