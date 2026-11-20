// Design Ref: §9 — OPENAI_API_KEY, OPENAI_MODEL_CHOICE는 서버 전용 환경 변수이며 화면(브라우저) 코드로 나가면 안 된다.
// Plan SC: "API 키가 코드·화면·GitHub에 나타나지 않음"
//
// 이 파일은 서버 코드(예: app/api/chat/route.ts)에서만 불러 쓴다.
// 아래 import 한 줄이 "안전 잠금장치"다. 화면용 파일(브라우저에서 실행되는 파일)이
// 실수로 이 파일을 불러오면, 키가 새기 전에 빌드가 멈추고 오류가 난다.
import "server-only";

import OpenAI from "openai";
import { resolveModel } from "./models";

// 키가 없을 때 사용자에게 보여줄 문장이 아니라, 개발자(김규형 님)가 원인을 바로 알 수 있도록 하는 안내다.
// 키 값 자체는 어디에도 출력하지 않는다.
function readRequiredEnv(name: "OPENAI_API_KEY"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} 값이 .env 파일에 없습니다. .env에 ${name}=... 한 줄을 추가한 뒤 서버를 다시 시작해 주세요.`
    );
  }
  return value;
}

// 서버가 켜져 있는 동안 AI 연결 도구를 한 번만 만들어 재사용한다.
let client: OpenAI | undefined;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: readRequiredEnv("OPENAI_API_KEY") });
  }
  return client;
}

// 모델은 gpt-4o-mini로 고정이다. 관리자가 .env의 OPENAI_MODEL_CHOICE에 허용된 상위 모델 이름을 적으면 그 모델을 쓴다.
// (규칙은 lib/models.ts. 옛 OPENAI_MODEL 값은 읽지 않는다.)
export function getOpenAIModel(): string {
  return resolveModel(process.env.OPENAI_MODEL_CHOICE);
}
