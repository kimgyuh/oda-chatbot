// PLAN 13번 — 자주 묻는 질문 버튼의 질문이 실제로 답할 수 있는 질문인지 시험.
import { describe, expect, it } from "vitest";
import sources from "../data/oda-sources.json";
import { checkQuestion } from "../lib/checks";
import { FAQ_QUESTIONS } from "../lib/faq";
import { searchSources } from "../lib/search";

describe("FAQ_QUESTIONS", () => {
  it("5개다 (PRD: 5개 이내)", () => {
    expect(FAQ_QUESTIONS.length).toBe(5);
  });

  it("서로 다른 질문이다", () => {
    expect(new Set(FAQ_QUESTIONS).size).toBe(FAQ_QUESTIONS.length);
  });

  it.each(FAQ_QUESTIONS)("입력 검사를 통과한다: %s", (question) => {
    expect(checkQuestion(question).ok).toBe(true);
  });

  it.each(FAQ_QUESTIONS)("자료에서 관련 조각을 찾는다: %s", (question) => {
    expect(searchSources(question, sources).length).toBeGreaterThan(0);
  });
});
