// 자동 시험(Vitest) 설정. tests 폴더의 *.test.ts 파일만 시험으로 실행한다.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // 코드 안의 "@/lib/..." 같은 경로를 프로젝트 폴더 기준으로 읽게 한다. (tsconfig.json의 paths와 같은 규칙)
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
