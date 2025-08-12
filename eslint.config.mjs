import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import compat from "@eslint/compat";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-page-custom-font": "off",
      "@typescript-eslint/no-empty-object-type": "off", // 👈 Add this line
    },
  },
];

export default eslintConfig;
