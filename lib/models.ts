// AI 모델 선택 규칙. 기본은 gpt-4o-mini로 "고정"이고, 상위 모델은 관리자(김규형 님)가 .env로만 고를 수 있다.
// 사용자가 화면에서 모델을 고르는 기능은 만들지 않는다. (비싼 모델을 마음대로 골라 OpenAI 비용이 늘어나는 것을 막기 위해)
//
// 사용법: .env에 한 줄을 적는다.        OPENAI_MODEL_CHOICE=gpt-6-luna
//         비우거나 줄을 지우면 기본 모델(gpt-4o-mini)을 쓴다.
// 예전에 쓰던 OPENAI_MODEL 값은 더 이상 읽지 않는다. (지워도 된다)
//
// 주의: 2026-11-20에 OpenAI 공식 문서로 확인했을 때 gpt-4o-mini는 2027-01-14에 서비스가 중단될 예정이고,
//       OpenAI가 안내한 대체 모델은 gpt-6-luna다. 그 전에 기본 모델을 바꾸는 것을 권한다.
// 외부 도구에 기대지 않는 순수 코드라서 자동 시험에서 그대로 시험할 수 있다.

export const DEFAULT_MODEL = "gpt-4o-mini";

// 관리자가 고를 수 있는 모델 목록. 목록에 없는 이름은 오타·실수로 보고 거절한다.
export const SELECTABLE_MODELS: readonly string[] = [DEFAULT_MODEL, "gpt-6-luna"];

// .env의 OPENAI_MODEL_CHOICE 값(없으면 undefined)을 받아 실제로 쓸 모델 이름을 돌려준다.
export function resolveModel(choice: string | undefined | null): string {
  const value = choice?.trim();
  if (!value) return DEFAULT_MODEL;
  if (SELECTABLE_MODELS.includes(value)) return value;
  // 원인을 바로 알 수 있도록 허용 목록을 알려 준다. (모델 이름은 비밀 값이 아니다)
  throw new Error(
    `OPENAI_MODEL_CHOICE 값이 허용된 모델이 아닙니다. 허용: ${SELECTABLE_MODELS.join(", ")} (비워 두면 ${DEFAULT_MODEL}을 씁니다)`
  );
}
