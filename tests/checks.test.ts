// PLAN 10번 — 입력 검사(빈 질문, 500자 초과, 개인정보, ODA 무관 질문) 시험.
import { describe, expect, it } from "vitest";
import { MAX_QUESTION_LENGTH, checkQuestion } from "../lib/checks";
import { MESSAGES, SERVER_MESSAGES } from "../lib/messages";

function code(question: unknown) {
  const result = checkQuestion(question);
  return result.ok ? "ok" : result.code;
}

describe("checkQuestion: 통과해야 하는 정상 질문", () => {
  it.each([
    "ODA가 뭐예요?",
    "유상원조와 무상원조는 뭐가 달라요?",
    "KOICA는 무엇인가요?",
    "코이카는 언제 만들어졌어요",
    "국제개발협력기본법은 언제 시행됐어요?",
    "씨앗 CIAT가 뭐야?",
    "우리나라는 어느 지역을 많이 지원하나요?", // "ODA"라는 말이 없어도 통과
    "우리 단체가 KOICA 사업에 선정될 수 있을까요?",
    "ODA 2026-02-26 업데이트가 뭐예요", // 날짜가 전화번호로 오인되면 안 됨
    "ODA 2010년 7월 26일 시행 맞아요? 4,031백만 달러",
  ])("%s", (question) => {
    expect(code(question)).toBe("ok");
  });

  it("앞뒤 공백을 뺀 질문을 돌려준다", () => {
    const result = checkQuestion("   ODA가 뭐예요?  ");
    expect(result).toEqual({ ok: true, question: "ODA가 뭐예요?" });
  });
});

describe("checkQuestion: 빈 질문", () => {
  const emptyCases: [unknown, string][] = [
    ["", "빈 문자열"],
    ["   ", "공백만"],
    [undefined, "값 없음"],
    [null, "null"],
    [123, "숫자"],
  ];
  it.each(emptyCases)(
    "%s (%s)",
    (question) => {
      const result = checkQuestion(question);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("EMPTY_QUESTION");
        expect(result.message).toBe(MESSAGES.EMPTY_QUESTION);
        expect(result.status).toBe(400);
      }
    }
  );
});

describe("checkQuestion: 500자 초과", () => {
  it("정확히 500자는 통과", () => {
    expect(code("ODA" + "가".repeat(MAX_QUESTION_LENGTH - 3))).toBe("ok");
  });
  it("501자는 안내", () => {
    const result = checkQuestion("ODA" + "가".repeat(MAX_QUESTION_LENGTH - 2));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(SERVER_MESSAGES.TOO_LONG);
  });
});

describe("checkQuestion: 개인정보", () => {
  it.each([
    "제 번호는 010-1234-5678 입니다. ODA 알려줘",
    "제 번호는 01012345678 입니다. ODA 알려줘",
    "hong@example.com 으로 ODA 자료 보내줘",
    "주민번호 900101-1234567 ODA",
    "02-123-4567로 연락 ODA",
  ])("%s", (question) => {
    const result = checkQuestion(question);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PERSONAL_INFO");
      expect(result.message).toBe(SERVER_MESSAGES.PERSONAL_INFO);
    }
  });
});

describe("checkQuestion: ODA와 무관한 질문", () => {
  it.each(["오늘 날씨 알려줘", "점심 메뉴 추천해줘", "파이썬으로 정렬하는 방법", "대한민국 대통령은 누구야?", "손흥민 요즘 어때?", "안녕하세요"])(
    "%s",
    (question) => {
      const result = checkQuestion(question);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("OFF_TOPIC");
        expect(result.message).toBe(SERVER_MESSAGES.OFF_TOPIC);
      }
    }
  );
});
