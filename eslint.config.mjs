import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 비공개 이미지는 인증 쿠키가 필요한 프록시 경로로 제공하므로 next/image 최적화를 쓰지 않는다.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/sw.js", ".smoke-out/**", "e2e/playwright-report/**", "e2e/test-results/**"]),
]);

export default eslintConfig;
