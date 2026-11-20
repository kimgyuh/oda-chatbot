// AI 모델 선택 규칙 시험 — 기본은 gpt-4o-mini로 고정, 상위 모델은 허용 목록 안에서만 선택.
import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, SELECTABLE_MODELS, resolveModel } from "../lib/models";

describe("기본 모델은 gpt-4o-mini로 고정", () => {
  it("기본 모델 이름", () => {
    expect(DEFAULT_MODEL).toBe("gpt-4o-mini");
  });

  it.each([undefined, null, "", "   "])("선택값이 %j 이면 기본 모델", (choice) => {
    expect(resolveModel(choice)).toBe("gpt-4o-mini");
  });

  it("기본 모델을 직접 적어도 같다", () => {
    expect(resolveModel("gpt-4o-mini")).toBe("gpt-4o-mini");
    expect(resolveModel("  gpt-4o-mini  ")).toBe("gpt-4o-mini");
  });
});

describe("상위 모델은 허용 목록 안에서만 선택", () => {
  it("허용 목록에는 기본 모델과 gpt-6-luna가 있다", () => {
    expect([...SELECTABLE_MODELS]).toEqual(["gpt-4o-mini", "gpt-6-luna"]);
  });

  it("gpt-6-luna를 고르면 그 모델을 쓴다", () => {
    expect(resolveModel("gpt-6-luna")).toBe("gpt-6-luna");
  });

  it.each(["gpt-5.4-mini", "gpt-4o", "GPT-6-LUNA", "gpt-6-luna; drop", "아무거나"])(
    "허용되지 않은 이름 %j 은 거절하고, 원인을 알려 준다",
    (choice) => {
      expect(() => resolveModel(choice)).toThrow(/OPENAI_MODEL_CHOICE/);
      expect(() => resolveModel(choice)).toThrow(/gpt-4o-mini, gpt-6-luna/);
    }
  );

  it("오류 문장은 서버 로그에 남기는 'OPENAI_'로 시작한다 (route.ts의 로그 규칙)", () => {
    try {
      resolveModel("nope");
    } catch (error) {
      expect((error as Error).message.startsWith("OPENAI_")).toBe(true);
    }
  });
});
