// Design Ref: §7 — "쿠키로 하루 질문 수 세기". 로그인 없이 한 사람(브라우저)당 하루 20개까지 질문할 수 있게 한다.
// Plan SC: 한 사람당 하루 질문 20개를 넘으면 안내 문구가 나온다. (PRD 5번 M1)
//
// 한계(알고 선택함): 사용자가 쿠키를 지우거나 다른 브라우저를 쓰면 횟수가 다시 20개로 돌아간다.
//                    이번 실습의 비용 보호 목적에는 충분하고, 더 단단히 막으려면 외부 저장소가 필요하다. (PRD 범위 밖)
// 외부 도구에 기대지 않는 순수 코드라서 자동 시험(PLAN 12번)에서 그대로 시험할 수 있다.

// 하루에 물어볼 수 있는 질문 수. 안내 문구(SERVER_MESSAGES.DAILY_LIMIT)의 "20개"와 같이 고친다.
export const DAILY_LIMIT = 20;
export const DAILY_COOKIE_NAME = "oda_daily";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 48; // 날짜가 바뀌면 횟수를 0으로 보므로 넉넉히 이틀 보관한다.

// 오늘 날짜(한국 시간 기준, YYYY-MM-DD). "하루"는 한국 시간 자정에 바뀐다.
export function todayKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}

// 쿠키 값("2026-11-20:7")에서 오늘 쓴 횟수를 꺼낸다. 값이 없거나 이상하거나 어제 날짜면 0으로 본다.
export function parseCount(value: string | undefined | null, today: string = todayKst()): number {
  if (!value) return 0;
  const match = value.match(/^(\d{4}-\d{2}-\d{2}):(\d{1,4})$/);
  if (!match || match[1] !== today) return 0;
  return Number(match[2]);
}

// 요청의 Cookie 머리글 전체("a=1; oda_daily=2026-11-20:7; b=2")에서 오늘 쓴 횟수를 꺼낸다.
export function readCountFromHeader(
  cookieHeader: string | null,
  today: string = todayKst()
): number {
  if (!cookieHeader) return 0;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === DAILY_COOKIE_NAME) return parseCount(rest.join("="), today);
  }
  return 0;
}

export function remainingOf(count: number): number {
  return Math.max(0, DAILY_LIMIT - count);
}

// 응답에 붙일 Set-Cookie 값. 화면 코드(자바스크립트)가 읽지 못하도록 HttpOnly로 두고,
// 남은 횟수는 서버 응답의 remaining 값으로 알려준다.
export function buildSetCookie(
  count: number,
  today: string = todayKst(),
  secure: boolean = process.env.NODE_ENV === "production"
): string {
  const parts = [
    `${DAILY_COOKIE_NAME}=${today}:${count}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
