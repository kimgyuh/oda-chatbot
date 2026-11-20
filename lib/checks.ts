// Design Ref: §4 — 서버 검사 단계: 빈 질문 → 500자 초과 → 개인정보 → ODA와 무관한 질문.
// 하나라도 걸리면 AI를 부르지 않고 PRD 9번의 안내 문구를 돌려준다. (비용 절약 + 개인정보 보호)
// 외부 도구에 기대지 않는 순수 코드라서 자동 시험(PLAN 12번)에서 그대로 시험할 수 있다.
import { MESSAGES, SERVER_MESSAGES } from "./messages";

export const MAX_QUESTION_LENGTH = 500;

export type CheckResult =
  | { ok: true; question: string }
  | {
      ok: false;
      status: number;
      code: "EMPTY_QUESTION" | "TOO_LONG" | "PERSONAL_INFO" | "OFF_TOPIC";
      message: string;
    };

// 전화번호·이메일·주민등록번호처럼 보이는 글. (이름은 일반 낱말과 구별할 수 없어 검사하지 않고, 화면 안내 문구로 막는다)
const PERSONAL_INFO_PATTERNS: readonly RegExp[] = [
  /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+/i, // 이메일
  /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/, // 휴대전화
  /\b0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}\b/, // 일반 전화 (02-123-4567 등)
  /\d{6}[-\s]?[1-4]\d{6}/, // 주민등록번호
];

// ODA와 관련 있어 보이는 낱말. 이 중 하나도 없으면 "ODA와 무관한 질문"으로 본다.
// 너무 좁게 잡으면 맞는 질문을 막으므로 넓게 잡고, 애매한 질문은 자료 검색과 AI 규칙이 한 번 더 걸러낸다.
const ODA_KEYWORDS: readonly string[] = [
  // 영문
  "oda", "koica", "edcf", "oecd", "dac", "sdg", "kdrt", "ciat", "iati",
  // 개념·법·체계
  "원조", "개발도상", "개도국", "개발협력", "국제협력", "국제개발", "협력대상", "수원국", "공여국",
  "유상", "무상", "차관", "양자", "다자", "증여", "빈곤", "기본정신", "기본법", "추진체계", "법적체계",
  "주관기관", "시행기관", "국제기구", "국제사회", "지속가능발전", "개발정책",
  // 기관
  "코이카", "한국국제협력단", "국무조정실", "외교부", "재정경제부", "수출입은행", "국제개발협력위원회",
  // KOICA 사업
  "국별협력", "글로벌연수", "연수사업", "인재양성", "혁신적개발", "시민사회협력", "인도적", "긴급구호",
  "구호대", "씨앗", "개발컨설팅", "프로젝트형", "해외봉사", "협력사업",
  // 이 낱말들만 있는 질문은 "ODA"를 말하지 않아도 ODA 질문일 수 있다. (예: "어느 지역을 많이 지원하나요?")
  // 정말 ODA 질문이 아니면 자료 검색과 AI 규칙이 "확인되지 않는 내용입니다"로 한 번 더 걸러낸다.
  "지원", "사업", "협력", "아프리카", "아시아", "중남미", "중동",
  // 국가별 사업 질문 (예: "베트남은 어떤 사업을 해요?"). 챗봇 자료에 실린 나라 이름.
  "중점협력국", "베트남", "캄보디아", "인도네시아", "필리핀", "라오스", "방글라데시", "몽골", "미얀마", "네팔",
  "에티오피아", "탄자니아", "우간다", "페루", "우즈베키스탄", "콜롬비아", "가나",
];

function looksLikePersonalInfo(text: string): boolean {
  return PERSONAL_INFO_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeOda(text: string): boolean {
  const lower = text.toLowerCase();
  return ODA_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// 질문을 서버로 받은 직후 가장 먼저 부른다. 통과하면 앞뒤 공백을 뺀 질문을 돌려준다.
export function checkQuestion(raw: unknown): CheckResult {
  const question = typeof raw === "string" ? raw.trim() : "";

  if (!question) {
    return { ok: false, status: 400, code: "EMPTY_QUESTION", message: MESSAGES.EMPTY_QUESTION };
  }
  // 한글·이모지도 한 글자로 세기 위해 문자열을 글자 단위로 펼쳐서 센다.
  if ([...question].length > MAX_QUESTION_LENGTH) {
    return { ok: false, status: 400, code: "TOO_LONG", message: SERVER_MESSAGES.TOO_LONG };
  }
  if (looksLikePersonalInfo(question)) {
    return { ok: false, status: 400, code: "PERSONAL_INFO", message: SERVER_MESSAGES.PERSONAL_INFO };
  }
  if (!looksLikeOda(question)) {
    return { ok: false, status: 400, code: "OFF_TOPIC", message: SERVER_MESSAGES.OFF_TOPIC };
  }
  return { ok: true, question };
}
