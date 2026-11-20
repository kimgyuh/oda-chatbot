// Design Ref: §4·§5 — POST /api/chat: 질문 → 검사 → 하루 한도 확인 → 관련 자료 찾기 → (자료가 있으면) AI가 자료만 보고 답하기 → 글자 단위로 전달.
// Plan SC: "답변의 첫 글자가 질문 후 10초 이내에 나오기 시작", "한 사람당 하루 질문 20개 제한"
import { checkQuestion } from "@/lib/checks";
import {
  DAILY_LIMIT,
  buildSetCookie,
  readCountFromHeader,
  remainingOf,
} from "@/lib/dailyLimit";
import { MESSAGES, SERVER_MESSAGES } from "@/lib/messages";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { buildMessages } from "@/lib/prompt";
import { searchSources } from "@/lib/search";
import { ODA_SOURCES, toPublicSource, type OdaSource } from "@/lib/sources";

const encoder = new TextEncoder();

// AI 답변 한 번에 만들 수 있는 최대 분량(토큰). 한글 5문장은 보통 300토큰 안팎이다.
const MAX_ANSWER_TOKENS = 1200;

// 요청 본문 크기 상한(바이트). 질문은 500자(한글 약 1.5KB)이므로 넉넉하게 10KB.
const MAX_BODY_BYTES = 10_000;

// 화면으로 보내는 정상 답변의 첫 줄. (DESIGN §5: 출처 후보 목록과 오늘 남은 질문 수)
// sources: AI에게 준 자료 조각의 출처 정보. 화면이 답변 끝의 "[출처: S4]" 줄을 읽어 실제로 쓰인 것만 보여준다.
function metaLine(remaining: number, sources: readonly OdaSource[] = []) {
  return JSON.stringify({ sources: sources.map(toPublicSource), remaining }) + "\n";
}

// 서버 검사에 걸렸을 때 돌려주는 "안내" 모양. 이 경우에는 질문 횟수를 늘리지 않는다.
function errorResponse(
  status: number,
  code: string,
  message: string,
  remaining: number
) {
  return Response.json({ error: { code, message }, remaining }, { status });
}

// 정상 답변 응답의 공통 머리글. 질문 횟수가 늘었으므로 새 횟수를 쿠키에 적어 보낸다.
function answerHeaders(newCount: number) {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Set-Cookie": buildSetCookie(newCount),
  };
}

// AI가 보내는 조각(chunk)들에서 다음 "글자가 있는" 조각을 꺼낸다. 더 이상 없으면 null.
async function nextText(
  iterator: AsyncIterator<{ choices: { delta?: { content?: string | null } }[] }>
): Promise<string | null> {
  for (;;) {
    const { value, done } = await iterator.next();
    if (done) return null;
    const text = value.choices[0]?.delta?.content;
    if (text) return text;
  }
}

export async function POST(request: Request) {
  // 오늘 이미 몇 개를 물어봤는지 쿠키에서 읽는다. (쿠키가 없거나 어제 것이면 0)
  const usedCount = readCountFromHeader(request.headers.get("cookie"));

  // 0) 요청 자체를 먼저 확인한다. (Check 보안 점검 2번) AI를 부르기 전에 거절하므로 비용이 들지 않는다.
  //    - 다른 웹사이트가 방문자의 브라우저를 시켜 보낸 요청(Sec-Fetch-Site가 same-origin이 아님)
  //    - JSON이 아닌 형식(단순 글 형식으로 몰래 보내는 요청에 쓰이는 방식)
  //    - 너무 큰 요청 (질문은 500자 이내이므로 10KB면 충분)
  //    Sec-Fetch-Site는 브라우저가 붙이는 값이라, 직접 만든 시험 요청처럼 값이 없는 경우는 통과시킨다.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return errorResponse(403, "BAD_REQUEST", SERVER_MESSAGES.BAD_REQUEST, remainingOf(usedCount));
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorResponse(415, "BAD_REQUEST", SERVER_MESSAGES.BAD_REQUEST, remainingOf(usedCount));
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return errorResponse(413, "BAD_REQUEST", SERVER_MESSAGES.BAD_REQUEST, remainingOf(usedCount));
  }

  // 1) 질문 꺼내기. 머리글(Content-Length)만 믿지 않고 본문을 읽어서 크기를 직접 센다.
  //    본문이 깨졌으면 빈 질문으로 취급한다.
  const bodyText = await request.text();
  if (encoder.encode(bodyText).length > MAX_BODY_BYTES) {
    return errorResponse(413, "BAD_REQUEST", SERVER_MESSAGES.BAD_REQUEST, remainingOf(usedCount));
  }
  let rawQuestion: unknown;
  try {
    rawQuestion = JSON.parse(bodyText)?.question;
  } catch {
    rawQuestion = undefined;
  }

  // 2) 입력 검사 (PRD 9번): 빈 질문, 500자 초과, 개인정보, ODA와 무관한 질문이면 AI를 부르지 않고 안내만 돌려준다.
  const checked = checkQuestion(rawQuestion);
  if (!checked.ok) {
    return errorResponse(checked.status, checked.code, checked.message, remainingOf(usedCount));
  }
  const question = checked.question;

  // 3) 하루 한도 확인 (PRD 5번 M1): 20개를 모두 썼으면 안내만 돌려준다.
  if (usedCount >= DAILY_LIMIT) {
    return errorResponse(429, "DAILY_LIMIT", SERVER_MESSAGES.DAILY_LIMIT, 0);
  }
  const newCount = usedCount + 1;
  const remaining = remainingOf(newCount);

  // 4) 질문과 관련된 자료 조각 찾기. 하나도 없으면 AI를 부르지 않고 "확인되지 않는 내용입니다"로 답한다.
  //    (지어내는 답변을 막고 비용도 아끼는 가장 확실한 방법)
  const related = searchSources(question, ODA_SOURCES).map((result) => result.source);
  if (related.length === 0) {
    return new Response(metaLine(remaining) + MESSAGES.NO_SOURCE, {
      headers: answerHeaders(newCount),
    });
  }

  // 5) 찾은 자료와 규칙을 AI에게 보내고, 나오는 글자부터 바로 받는다.
  try {
    const aiStream = await getOpenAIClient().chat.completions.create({
      model: getOpenAIModel(),
      stream: true,
      // 답변 길이 상한(Check 보안 점검 3번). "5문장 이내"는 AI에게 하는 부탁일 뿐이라, 실제로 막는 장치를 둔다.
      // 생각 과정을 거치는 모델은 그 분량도 이 숫자에 들어가므로 넉넉히 잡았다. 답이 중간에 잘리면 숫자를 늘린다.
      max_completion_tokens: MAX_ANSWER_TOKENS,
      messages: buildMessages(question, related),
    });

    // 첫 번째 글자가 올 때까지 기다려서 확인한다. 글자가 하나도 오기 전에 AI가 실패하거나 빈 답을 보내면
    // 아래 catch로 가서 오류 안내(502)를 돌려주고, 질문 횟수도 늘리지 않는다. (Check에서 찾은 Gap 1)
    const iterator = aiStream[Symbol.asyncIterator]();
    const firstText = await nextText(iterator);
    if (firstText === null) {
      throw new Error("AI가 빈 답변을 보냈습니다");
    }

    // 6) 화면으로 보내는 모양 (DESIGN §5): 첫 줄은 JSON 한 줄, 그 아래로 답변 글자들이 이어진다.
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(metaLine(remaining, related)));
        controller.enqueue(encoder.encode(firstText));
        try {
          for (;;) {
            const text = await nextText(iterator);
            if (text === null) break;
            controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (error) {
          // 답변 도중에 AI 쪽 오류가 나면 연결을 "오류"로 끊는다. 화면은 이를 알아채고 끊긴 답변 대신
          // 오류 안내를 보여준다. (키 등 비밀 값은 기록하지 않음)
          console.error("[chat] 스트리밍 중 오류:", (error as Error)?.name);
          controller.error(error);
        }
      },
      cancel() {
        // 사용자가 화면을 닫으면 AI 쪽 요청도 멈춰 비용을 아낀다.
        aiStream.controller.abort();
      },
    });

    return new Response(body, { headers: answerHeaders(newCount) });
  } catch (error) {
    // 키·모델 설정 누락, AI 서비스 장애 등. 원인은 서버 로그에만 남기고 사용자에게는 안내 문구만 보여준다.
    // 로그에는 오류 종류와 상태 번호만 남긴다. (AI 서비스의 오류 문장에는 키의 일부가 섞일 수 있어 기록하지 않음)
    // 단, 우리가 만든 ".env 값 없음" 안내(OPENAI_...로 시작)는 원인 파악을 위해 그대로 남긴다.
    const e = error as { name?: string; status?: number; message?: string };
    console.error(
      "[chat] AI 호출 실패:",
      e?.name,
      e?.status ?? "",
      e?.message?.startsWith("OPENAI_") ? e.message : ""
    );
    // 답을 받지 못했으므로 질문 횟수는 늘리지 않는다. (쿠키를 갱신하지 않음)
    return errorResponse(502, "AI_ERROR", MESSAGES.AI_ERROR, remainingOf(usedCount));
  }
}
