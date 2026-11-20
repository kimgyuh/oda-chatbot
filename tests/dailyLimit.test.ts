// PLAN 11번 — 하루 20개 질문 제한(쿠키로 세기) 시험.
import { describe, expect, it } from "vitest";
import {
  DAILY_COOKIE_NAME,
  DAILY_LIMIT,
  buildSetCookie,
  parseCount,
  readCountFromHeader,
  remainingOf,
  todayKst,
} from "../lib/dailyLimit";
import { SERVER_MESSAGES } from "../lib/messages";

describe("todayKst: 한국 시간 기준 날짜", () => {
  it("UTC 15시 이후는 한국 시간으로 다음 날이다", () => {
    expect(todayKst(new Date("2026-11-20T14:59:00Z"))).toBe("2026-11-20");
    expect(todayKst(new Date("2026-11-20T15:00:00Z"))).toBe("2026-11-21");
  });
});

describe("parseCount: 쿠키 값에서 오늘 횟수 읽기", () => {
  const today = "2026-11-20";
  it("오늘 날짜면 그 횟수", () => expect(parseCount("2026-11-20:7", today)).toBe(7));
  it("어제 날짜면 0", () => expect(parseCount("2026-11-19:20", today)).toBe(0));
  it.each([undefined, null, "", "abc", "2026-11-20", "2026-11-20:abc", "<script>:99999", "2026-11-20:-1", "2026-11-20:12345"])(
    "이상한 값 %j 은 0",
    (value) => expect(parseCount(value, today)).toBe(0)
  );
});

describe("readCountFromHeader: Cookie 머리글에서 읽기", () => {
  const today = "2026-11-20";
  it("여러 쿠키 중 우리 쿠키만 읽는다", () => {
    expect(readCountFromHeader(`a=1; ${DAILY_COOKIE_NAME}=2026-11-20:5; b=2`, today)).toBe(5);
  });
  it("쿠키가 없으면 0", () => {
    expect(readCountFromHeader(null, today)).toBe(0);
    expect(readCountFromHeader("a=1; b=2", today)).toBe(0);
  });
});

describe("remainingOf", () => {
  it("남은 횟수 = 한도 - 사용", () => {
    expect(remainingOf(0)).toBe(DAILY_LIMIT);
    expect(remainingOf(1)).toBe(DAILY_LIMIT - 1);
    expect(remainingOf(DAILY_LIMIT)).toBe(0);
  });
  it("음수가 되지 않는다", () => expect(remainingOf(DAILY_LIMIT + 5)).toBe(0));
});

describe("buildSetCookie", () => {
  it("날짜:횟수와 보안 속성을 담는다", () => {
    const cookie = buildSetCookie(3, "2026-11-20", false);
    expect(cookie).toContain(`${DAILY_COOKIE_NAME}=2026-11-20:3`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure");
  });
  it("운영(https)에서는 Secure를 붙인다", () => {
    expect(buildSetCookie(3, "2026-11-20", true)).toContain("Secure");
  });
  it("만든 쿠키 값을 다시 읽으면 같은 횟수다", () => {
    const value = buildSetCookie(9, "2026-11-20", false).split(";")[0];
    expect(readCountFromHeader(value, "2026-11-20")).toBe(9);
  });
});

describe("안내 문구와 한도 숫자가 같다", () => {
  it(`한도 초과 문구에 ${DAILY_LIMIT}개가 들어 있다`, () => {
    expect(SERVER_MESSAGES.DAILY_LIMIT).toContain(`${DAILY_LIMIT}개`);
  });
});
