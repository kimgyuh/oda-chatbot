// 서버 주소(POST /api/chat) 시험 — AI는 가짜로 바꿔 끼워서(비용 0), 서버가 오류·한도·검사를 설계대로 처리하는지 확인한다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DAILY_COOKIE_NAME, DAILY_LIMIT, todayKst } from "../lib/dailyLimit";
import { MESSAGES, SERVER_MESSAGES } from "../lib/messages";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

// 진짜 AI 연결 파일(키를 읽는 파일) 대신 가짜를 쓴다.
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: () => ({ chat: { completions: { create: mocks.create } } }),
  getOpenAIModel: () => "test-model",
}));

import { POST } from "../app/api/chat/route";

type Chunk = { choices: { delta?: { content?: string | null } }[] };
const chunk = (content: string | null): Chunk => ({ choices: [{ delta: { content } }] });

// 가짜 AI 응답: chunks를 차례로 내보내고, failAfter 개를 내보낸 뒤 오류를 낸다.
function fakeStream(chunks: Chunk[], failAfter?: number) {
  return {
    controller: { abort: vi.fn() },
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (failAfter !== undefined && i >= failAfter) throw new Error("AI 연결이 끊겼습니다");
          if (i >= chunks.length) return { value: undefined, done: true as const };
          return { value: chunks[i++], done: false as const };
        },
      };
    },
  };
}

function post(question: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ question }),
  });
}

const cookieOf = (count: number) => `${DAILY_COOKIE_NAME}=${todayKst()}:${count}`;

beforeEach(() => {
  mocks.create.mockReset();
});

describe("정상 답변", () => {
  it("글자를 흘려보내고, 질문 횟수를 1 늘리며, 출처 후보와 남은 횟수를 첫 줄에 담는다", async () => {
    mocks.create.mockResolvedValue(
      fakeStream([chunk("ODA는 "), chunk("원조입니다.\n[출처: S4]")])
    );
    const res = await POST(post("ODA가 뭐예요?"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${DAILY_COOKIE_NAME}=${todayKst()}:1`);

    const [metaLine, ...rest] = (await res.text()).split("\n");
    const meta = JSON.parse(metaLine);
    expect(meta.remaining).toBe(DAILY_LIMIT - 1);
    expect(meta.sources.length).toBeGreaterThan(0);
    expect(meta.sources[0]).not.toHaveProperty("text"); // 자료 본문은 화면으로 보내지 않는다
    expect(rest.join("\n")).toBe("ODA는 원조입니다.\n[출처: S4]");
  });

  it("AI에게 답변 길이 상한(max_completion_tokens)을 함께 보낸다", async () => {
    mocks.create.mockResolvedValue(fakeStream([chunk("답변입니다.\n[출처: S4]")]));
    await POST(post("ODA가 뭐예요?"));
    const args = mocks.create.mock.calls[0][0];
    expect(args.stream).toBe(true);
    expect(args.max_completion_tokens).toBeGreaterThan(0);
    expect(args.max_completion_tokens).toBeLessThanOrEqual(2000);
  });

  it("자료에 없는 질문은 AI를 부르지 않고 고정 문구로 답한다", async () => {
    const res = await POST(post("한국 지원금 신청 방법 알려줘"));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect((await res.text()).split("\n").slice(1).join("\n")).toBe(MESSAGES.NO_SOURCE);
  });
});

describe("AI 오류 (Check의 Gap 1): 오류 안내를 돌려주고 질문 횟수는 늘리지 않는다", () => {
  const expectAiError = async (res: Response) => {
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("AI_ERROR");
    expect(body.error.message).toBe(MESSAGES.AI_ERROR);
    expect(body.remaining).toBe(DAILY_LIMIT); // 횟수를 쓰지 않음
    expect(res.headers.get("set-cookie")).toBeNull();
  };

  it("AI 호출 자체가 실패", async () => {
    mocks.create.mockRejectedValue(new Error("서비스 오류"));
    await expectAiError(await POST(post("ODA가 뭐예요?")));
  });

  it("첫 글자가 오기 전에 연결이 끊김", async () => {
    mocks.create.mockResolvedValue(fakeStream([], 0));
    await expectAiError(await POST(post("ODA가 뭐예요?")));
  });

  it("AI가 빈 답변만 보냄", async () => {
    mocks.create.mockResolvedValue(fakeStream([chunk(null), chunk("")]));
    await expectAiError(await POST(post("ODA가 뭐예요?")));
  });

  it("답변 도중에 연결이 끊기면 스트림을 오류로 끝내 화면이 알 수 있게 한다", async () => {
    mocks.create.mockResolvedValue(fakeStream([chunk("ODA는 "), chunk("원조")], 1));
    const res = await POST(post("ODA가 뭐예요?"));
    expect(res.status).toBe(200);
    await expect(res.text()).rejects.toThrow();
  });
});

describe("요청 확인 (Check 보안 점검 2번): AI를 부르기 전에 거절한다", () => {
  const expectBadRequest = async (res: Response, status: number) => {
    expect(mocks.create).not.toHaveBeenCalled();
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toBe(SERVER_MESSAGES.BAD_REQUEST);
    expect(res.headers.get("set-cookie")).toBeNull();
  };

  it.each(["cross-site", "same-site", "none"])("Sec-Fetch-Site: %s 는 403", async (site) => {
    await expectBadRequest(await POST(post("ODA가 뭐예요?", { "sec-fetch-site": site })), 403);
  });

  it("같은 사이트(same-origin)에서 온 요청은 통과", async () => {
    mocks.create.mockResolvedValue(fakeStream([chunk("답변입니다.\n[출처: S4]")]));
    const res = await POST(post("ODA가 뭐예요?", { "sec-fetch-site": "same-origin" }));
    expect(res.status).toBe(200);
  });

  it("JSON이 아닌 형식(text/plain)은 415", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ question: "ODA가 뭐예요?" }),
    });
    await expectBadRequest(await POST(req), 415);
  });

  it("형식 표시가 없으면 415", async () => {
    const req = new Request("http://localhost/api/chat", { method: "POST", body: "{}" });
    await expectBadRequest(await POST(req), 415);
  });

  it("본문이 너무 크면(10KB 초과) 413", async () => {
    const res = await POST(post("ODA " + "가".repeat(5000)));
    await expectBadRequest(res, 413);
  });
});

describe("입력 검사와 하루 한도", () => {
  it.each([
    ["", "EMPTY_QUESTION", MESSAGES.EMPTY_QUESTION],
    ["오늘 날씨 알려줘", "OFF_TOPIC", SERVER_MESSAGES.OFF_TOPIC],
    ["제 번호는 010-1234-5678 입니다. ODA 알려줘", "PERSONAL_INFO", SERVER_MESSAGES.PERSONAL_INFO],
  ])("%j → %s (AI를 부르지 않음)", async (question, code, message) => {
    const res = await POST(post(question));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe(code);
    expect(body.error.message).toBe(message);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it(`하루 ${DAILY_LIMIT}개를 모두 썼으면 429 안내만 돌려주고 AI를 부르지 않는다`, async () => {
    const res = await POST(post("ODA가 뭐예요?", { cookie: cookieOf(DAILY_LIMIT) }));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("DAILY_LIMIT");
    expect(body.remaining).toBe(0);
  });

  it("마지막 1개(20번째)는 답하고 남은 횟수는 0이 된다", async () => {
    mocks.create.mockResolvedValue(fakeStream([chunk("답변입니다.\n[출처: S4]")]));
    const res = await POST(post("ODA가 뭐예요?", { cookie: cookieOf(DAILY_LIMIT - 1) }));
    expect(res.status).toBe(200);
    expect(JSON.parse((await res.text()).split("\n")[0]).remaining).toBe(0);
  });
});
