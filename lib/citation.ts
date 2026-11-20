// Design Ref: §4 — 10단계 "답변에 쓰인 출처·기준일 표시". 답변 맨 끝의 "[출처: S4, S5]" 줄을 읽어 낸다.
// Plan SC: "자료를 근거로 한 모든 답변에 출처 1개 이상" (PRD M2)
//
// AI는 답변 끝에 쓴 자료 번호를 "[출처: S4, S5]" 한 줄로 적는다. 화면은 이 줄을 글에서 빼고(사용자에게 보이지 않게),
// 적힌 번호의 자료만 말풍선 아래 출처·기준일로 보여준다.
// 외부 도구에 기대지 않는 순수 코드라서 자동 시험(PLAN 12번)에서 그대로 시험할 수 있다.
import { MESSAGES } from "./messages";

const MARKER = "[출처";

// 출처 없이 정해진 문구로만 답하는 경우. (PRD 9번) 이 문구로 시작하면 출처가 없어도 정상이다.
const FIXED_ANSWERS: readonly string[] = [
  MESSAGES.NO_SOURCE,
  MESSAGES.POLITICAL_OPINION,
  MESSAGES.INDIVIDUAL_CASE,
];

export type ParsedAnswer = {
  // 사용자에게 보여줄 답변 글 ("[출처…]" 줄은 뺀 것)
  body: string;
  // 답변 끝 줄에 적힌 자료 번호들 (중복 없음)
  citedIds: string[];
  // 출처 없이 정해진 문구로 답한 경우
  isFixed: boolean;
  // 그중 "확인되지 않는 내용입니다"(자료에 없는 질문)로 답한 경우 → 화면이 관련 기관 홈페이지 링크를 함께 보여준다.
  isNoSource: boolean;
};

// 글자가 한 글자씩 도착하는 도중에도 "[", "[출" 같은 마커의 앞부분이 화면에 잠깐 보이지 않도록 함께 뺀다.
export function parseAnswer(raw: string): ParsedAnswer {
  let body = raw;
  let citedIds: string[] = [];

  const markerAt = raw.lastIndexOf(MARKER);
  // AI가 가끔 "[출처: S14]" 대신 "[S14]"처럼 줄여 쓰는 경우도 같은 출처 줄로 본다.
  const shortForm = raw.match(/\s*\[((?:S\d+[\s,，]*)+)\]\s*$/);

  if (markerAt >= 0) {
    body = raw.slice(0, markerAt);
    citedIds = [...new Set(raw.slice(markerAt).match(/S\d+/g) ?? [])];
  } else if (shortForm && shortForm.index !== undefined) {
    body = raw.slice(0, shortForm.index);
    citedIds = [...new Set(shortForm[1].match(/S\d+/g) ?? [])];
  } else {
    // 아직 도착하는 중인 출처 줄의 앞부분("[", "[출", "[S", "[S1,")도 잠깐 화면에 보이지 않게 뺀다.
    const partialShort = raw.match(/\s*\[(?:S[\dS,，\s]*)?$/);
    if (partialShort && partialShort.index !== undefined) {
      body = raw.slice(0, partialShort.index);
    } else {
      for (let k = MARKER.length - 1; k >= 1; k--) {
        if (raw.endsWith(MARKER.slice(0, k))) {
          body = raw.slice(0, raw.length - k);
          break;
        }
      }
    }
  }

  body = body.trimEnd();
  const isFixed = FIXED_ANSWERS.some((message) => body.startsWith(message));
  const isNoSource = body.startsWith(MESSAGES.NO_SOURCE);
  return { body, citedIds, isFixed, isNoSource };
}
