// 국가별 사업 자료(S15~S26) 시험 — 진행 중/종료 구분이 빠지지 않았는지, 나라 이름으로 찾아지는지 확인한다.
import { describe, expect, it } from "vitest";
import sources from "../data/oda-sources.json";
import { checkQuestion } from "../lib/checks";
import { searchSources } from "../lib/search";

const countryChunks = sources.filter((source) => /^S(1[5-9]|2[0-6])$/.test(source.id));

describe("국가별 자료 형식", () => {
  it("12개 나라가 있다", () => {
    expect(countryChunks.length).toBe(12);
  });

  it.each(countryChunks.map((source) => [source.id, source.title] as const))("%s: 진행 중/종료 구분과 기준 설명이 있다 (%s)", (id) => {
    const text = sources.find((source) => source.id === id)!.text;
    expect(text).toContain("진행 중인 사업:");
    expect(text).toContain("종료된 사업:");
    expect(text).toContain("2026년 11월 20일 기준");
    expect(text).toContain("대표사업");
  });

  it("출처는 ODA Korea 국별현황 페이지이고 기준일 형식이 맞다", () => {
    for (const source of countryChunks) {
      expect(source.url).toBe("https://www.odakorea.go.kr/kor/info/country");
      expect(source.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("나라 이름으로 질문하면 그 나라 자료를 찾는다", () => {
  it.each([
    ["베트남에서 진행 중인 사업과 종료된 사업을 구분해서 알려줘", "S15"],
    ["캄보디아 사업 중 끝난 사업은 뭐가 있어?", "S16"],
    ["인도네시아 진행 중 사업", "S17"],
    ["필리핀에서 끝난 사업", "S18"],
    ["방글라데시에서 진행 중인 사업이 있어?", "S20"],
    ["에티오피아는 어떤 사업을 해?", "S21"],
    ["가나에서 하고 있는 사업은 뭐야?", "S23"],
    ["우간다에서 종료된 사업은 뭐야?", "S24"],
    ["페루에서 지원한 사업 알려줘", "S25"],
    ["우즈베키스탄 사업 알려줘", "S26"],
    ["한국의 중점협력국은 어디야?", "S27"],
    ["KOICA 해외사무소가 있는 아프리카 나라는?", "S29"],
  ])("%s → %s", (question, expectedId) => {
    expect(checkQuestion(question).ok).toBe(true);
    const ids = searchSources(question, sources).map((result) => result.source.id);
    expect(ids).toContain(expectedId);
  });
});

describe("진행 중/종료 분류 규칙 (종료 연도가 2026 이상이면 진행 중, 2025 이하면 종료)", () => {
  it("방글라데시는 진행 중인 대표사업이 없다", () => {
    const text = sources.find((source) => source.id === "S20")!.text;
    expect(text).toContain("진행 중인 사업: 없음.");
  });

  it("가나는 종료된 대표사업이 없다", () => {
    const text = sources.find((source) => source.id === "S23")!.text;
    expect(text).toContain("종료된 사업: 없음.");
  });

  it("베트남 떤반-년짝 도로(2021~2026)는 진행 중, 식품안전 시스템(2019~2025)은 종료", () => {
    const text = sources.find((source) => source.id === "S15")!.text;
    const [going, ended] = text.split("종료된 사업:");
    expect(going).toContain("떤반-년짝 도로 건설사업");
    expect(ended).toContain("식품안전행정시스템");
  });
});
