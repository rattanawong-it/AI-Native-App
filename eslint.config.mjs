import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ไฟล์ที่ Prisma generate ให้ — ไม่ใช่โค้ดที่เราเขียนเอง
    "app/generated/**",
    // ไฟล์ต้นแบบ UI ที่ export มาจาก Claude Design — เป็น prototype ไม่ใช่ซอร์สของแอป
    "project-ui/**",
  ]),
]);

export default eslintConfig;
