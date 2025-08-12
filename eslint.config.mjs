// Fallback: avoid using @eslint/compat if not installed
/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  {
    ignores: ["**/.next/**", "**/node_modules/**"],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"] ,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-page-custom-font": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];

export default eslintConfig;
