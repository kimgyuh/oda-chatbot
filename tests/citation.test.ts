// PLAN 8·9번 — 답변 끝의 "[출처: S4]" 줄 해석 시험.
import { describe, expect, it } from "vitest";
import { parseAnswer } from "../lib/citation";
import { MESSAGES } from "../lib/messages";

describe("parseAnswer: 출처 줄 읽기", () => {
  it("[출처: S4, S5] 형태", () => {
    const r = parseAnswer("ODA는 원조입니다.\n[출처: S4, S5]");
    expect(r.body).toBe("ODA는 원조입니다.");
    expect(r.citedIds).toEqual(["S4", "S5"]);
    expect(r.isFixed).toBe(false);
  });

  it("AI가 줄여 쓴 [S14] 형태도 읽는다", () => {
    const r = parseAnswer("내용입니다.\n[S14]");
    expect(r.body).toBe("내용입니다.");
    expect(r.citedIds).toEqual(["S14"]);
  });

  it("같은 번호가 겹쳐도 한 번만", () => {
    expect(parseAnswer("내용\n[출처: S1, S1, S2]").citedIds).toEqual(["S1", "S2"]);
  });

  it("출처 줄이 없으면 인용 없음", () => {
    const r = parseAnswer("그냥 답변");
    expect(r.body).toBe("그냥 답변");
    expect(r.citedIds).toEqual([]);
  });

  it("본문 중간의 [S1]은 출처 줄로 보지 않는다", () => {
    const r = parseAnswer("사업 [S1]은 중간에 있고 끝은 없다");
    expect(r.body).toBe("사업 [S1]은 중간에 있고 끝은 없다");
    expect(r.citedIds).toEqual([]);
  });
});

describe("parseAnswer: 글자가 도착하는 도중에는 출처 줄의 앞부분이 보이지 않는다", () => {
  it.each(["내용입니다.\n[", "내용입니다.\n[출", "내용입니다.\n[S", "내용입니다.\n[S1,", "내용입니다.\n[출처"])("%j", (raw) => {
    expect(parseAnswer(raw).body).toBe("내용입니다.");
  });

  it("닫는 괄호 전이라도 번호는 읽는다", () => {
    expect(parseAnswer("내용입니다.\n[출처: S1").citedIds).toEqual(["S1"]);
  });
});

describe("parseAnswer: 출처 없이 정해진 문구로 답하는 경우", () => {
  it("자료에 없는 질문", () => {
    const r = parseAnswer(MESSAGES.NO_SOURCE);
    expect(r.isFixed).toBe(true);
    expect(r.isNoSource).toBe(true);
  });

  it("정치·의견 질문", () => {
    const r = parseAnswer(MESSAGES.POLITICAL_OPINION);
    expect(r.isFixed).toBe(true);
    expect(r.isNoSource).toBe(false);
  });

  it("개별 판단 질문", () => {
    const r = parseAnswer(MESSAGES.INDIVIDUAL_CASE);
    expect(r.isFixed).toBe(true);
    expect(r.isNoSource).toBe(false);
  });

  it("일반 답변은 정해진 문구가 아니다", () => {
    expect(parseAnswer("ODA는 원조입니다.\n[출처: S4]").isFixed).toBe(false);
  });
});
