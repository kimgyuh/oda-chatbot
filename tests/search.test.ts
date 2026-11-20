// PLAN 6번 — 자료 검색 시험, 그리고 자료 파일(data/oda-sources.json)의 형식 점검.
import { describe, expect, it } from "vitest";
import sources from "../data/oda-sources.json";
import { searchSources, tokenize } from "../lib/search";

function ids(question: string): string[] {
  return searchSources(question, sources).map((result) => result.source.id);
}

describe("tokenize", () => {
  it("영문은 소문자 낱말로, 한글은 두 글자씩 겹쳐 자른다", () => {
    expect([...tokenize("KOICA 추진체계")].sort()).toEqual(["koica", "진체", "체계", "추진"].sort());
  });
  it("조사가 붙어도 핵심 낱말이 남는다", () => {
    expect(tokenize("ODA가").has("oda")).toBe(true);
  });
});

describe("searchSources: 질문에 맞는 자료를 찾는다", () => {
  it.each([
    ["ODA가 뭐예요?", "S4"],
    ["ODA로 인정받으려면 어떤 조건이 필요해?", "S4"],
    ["유상원조와 무상원조의 차이는?", "S5"],
    ["우리나라 ODA 추진체계를 알려줘", "S2"],
    ["국제개발협력기본법은 언제 만들어졌어?", "S3"],
    ["2024년 우리나라 ODA 지원 규모는?", "S6"],
    ["글로벌연수사업이 뭐예요", "S13"],
    ["씨앗 CIAT가 뭐야?", "S13"],
    ["해외긴급구호대는 뭘 하나요?", "S14"],
    ["국별협력사업의 프로젝트형과 개발컨설팅 차이", "S12"],
    ["KOICA 추진방향 네 가지가 뭐예요?", "S10"],
  ])("%s → %s 포함", (question, expectedId) => {
    expect(ids(question)).toContain(expectedId);
  });

  it("한 번에 최대 4개까지만 돌려준다", () => {
    expect(ids("우리나라 ODA 추진체계를 알려줘").length).toBeLessThanOrEqual(4);
  });

  it("점수 높은 순으로 돌려준다", () => {
    const scores = searchSources("우리나라 ODA 추진체계를 알려줘", sources).map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe("searchSources: 관련 없는 질문은 빈 결과", () => {
  it.each(["오늘 날씨 알려줘", "점심 메뉴 추천해줘", "파이썬으로 정렬하는 방법", "손흥민 요즘 어때?", "비트코인 지금 얼마야", "안녕하세요"])("%s", (question) => {
    expect(ids(question)).toEqual([]);
  });

  it("자료 목록이 비어 있으면 빈 결과", () => {
    expect(searchSources("ODA가 뭐예요?", [])).toEqual([]);
  });
});

describe("data/oda-sources.json 형식", () => {
  it("모든 조각에 필수 항목이 있다", () => {
    for (const source of sources) {
      for (const key of ["id", "org", "title", "url", "asOf", "text"] as const) {
        expect(typeof source[key], `${source.id}.${key}`).toBe("string");
        expect(source[key].length, `${source.id}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("조각 번호(id)가 겹치지 않는다", () => {
    const all = sources.map((source) => source.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("기준일은 YYYY-MM-DD 형식이다", () => {
    for (const source of sources) expect(source.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("원문 주소는 ODA Korea 또는 KOICA 공식 사이트다", () => {
    for (const source of sources) {
      expect(source.url, source.id).toMatch(/^https:\/\/www\.(odakorea|koica)\.go\.kr\//);
    }
  });
});
