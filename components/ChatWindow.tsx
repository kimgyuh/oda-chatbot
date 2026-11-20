"use client";

// Design Ref: §3 — 대화 영역: 내 질문(오른쪽)과 챗봇 답변(왼쪽)을 말풍선으로 구분해 보여준다.
// Design Ref: §4·§5 — 질문을 /api/chat으로 보내고, 서버가 흘려보내는 답변 글자를 오는 대로 이어 붙인다(스트리밍).
// Plan SC: 자료를 근거로 한 모든 답변에 출처(기관명·문서명)와 기준일을 1개 이상 붙인다. (PRD M2)
// 대화 기록은 저장하지 않는다. 새로고침하면 사라진다. (PRD 6번: 대화 기록 저장 안 함)
import { useEffect, useRef, useState } from "react";
import { parseAnswer } from "@/lib/citation";
import { AGENCY_LINKS, MESSAGES } from "@/lib/messages";
import type { PublicSource } from "@/lib/sources";
import ChatInput from "./ChatInput";
import FaqButtons from "./FaqButtons";

type Message = {
  id: number;
  role: "user" | "bot";
  // 서버가 보낸 글 그대로. 챗봇 답변에는 끝에 "[출처: S4]" 줄이 붙어 있을 수 있다. (화면에는 parseAnswer로 뺀 글을 보여줌)
  text: string;
  // 답변을 기다리는 중이면 true → "답변 중…"을 보여준다.
  pending?: boolean;
  // 서버가 첫 줄로 보내 준 출처 후보 목록. 이 중 답변 끝 줄에 적힌 번호의 것만 보여준다.
  sources?: PublicSource[];
};

const GREETING: Message = {
  id: 0,
  role: "bot",
  text: "안녕하세요! ODA(공적개발원조)에 대해 궁금한 점을 물어보세요.",
};

const MESSAGE_AI_ERROR = MESSAGES.AI_ERROR;

// 말풍선 아래에 보여줄 출처 목록. 답변 끝 줄에 적힌 번호와 같은 자료만 고른다.
function BotBubbleContent({ message }: { message: Message }) {
  if (message.pending) {
    return (
      <span className="animate-pulse text-[#666]">
        답변 중…
      </span>
    );
  }

  // 인사말·오류 안내처럼 서버 출처가 없는 말풍선은 글 그대로 보여준다.
  if (!message.sources) return <>{message.text}</>;

  const { body, citedIds, isNoSource } = parseAnswer(message.text);
  const cited = message.sources.filter((source) => citedIds.includes(source.id));

  return (
    <>
      {body}
      {/* 자료에 없는 질문: 관련 기관 홈페이지로 바로 갈 수 있게 링크를 보여준다. (PRD M2, 9번 예외 상황 2) */}
      {isNoSource && (
        <div className="mt-2 flex flex-wrap gap-2">
          {AGENCY_LINKS.map((agency) => (
            <a
              key={agency.url}
              href={agency.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-[#1d74a8] px-3 py-1 text-sm font-medium text-[#1d74a8] hover:bg-[#1d74a8]/10"
            >
              {agency.name} 홈페이지 ↗
            </a>
          ))}
        </div>
      )}
      {cited.length > 0 && (
        <div className="mt-2 border-t border-[#d9d9d9] pt-2 text-sm text-[#666]">
          <p className="font-medium text-[#2a4a8d]">출처</p>
          <ul className="mt-1 flex flex-col gap-1">
            {cited.map((source) => (
              <li key={source.id}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1d74a8] underline underline-offset-2 hover:text-[#004a8f]"
                >
                  {source.org} · {source.title}
                </a>
                <span className="block">
                  기준일: {source.asOf}
                  {source.asOfKind ? ` (${source.asOfKind})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function ChatWindow({ initialRemaining }: { initialRemaining: number }) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [answering, setAnswering] = useState(false);
  // 오늘 남은 질문 수. 서버가 답할 때마다 새 값을 알려준다. (DESIGN §5의 remaining)
  const [remaining, setRemaining] = useState(initialRemaining);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 새 말풍선이나 새 글자가 생기면 맨 아래로 스크롤한다.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // 화면을 떠나면 진행 중인 요청을 멈춘다. (서버 쪽 AI 요청도 함께 멈춰 비용을 아낀다)
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // 특정 말풍선만 골라서 바꾼다.
  function updateMessage(id: number, patch: Partial<Message>) {
    setMessages((prev) =>
      prev.map((message) => (message.id === id ? { ...message, ...patch } : message))
    );
  }

  async function handleSend(question: string) {
    const botId = nextId.current + 1;
    setMessages((prev) => [
      ...prev,
      { id: nextId.current, role: "user", text: question },
      { id: botId, role: "bot", text: "", pending: true },
    ]);
    nextId.current += 2;
    setAnswering(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      // 서버 검사에 걸린 경우(안내): JSON 한 덩어리로 오며, 화면에 보여줄 문구가 들어 있다.
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        if (typeof data?.remaining === "number") setRemaining(data.remaining);
        updateMessage(botId, {
          text: data?.error?.message ?? MESSAGE_AI_ERROR,
          pending: false,
        });
        return;
      }

      // 정상 답변: 첫 줄은 JSON({ sources, remaining }), 그 아래는 답변 글자들이다.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let metaRead = false;
      let answer = "";
      let candidates: PublicSource[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (!metaRead) {
          const lineEnd = buffer.indexOf("\n");
          if (lineEnd === -1) continue; // 첫 줄이 아직 다 안 왔다.
          const meta = JSON.parse(buffer.slice(0, lineEnd));
          candidates = meta.sources ?? [];
          if (typeof meta.remaining === "number") setRemaining(meta.remaining);
          updateMessage(botId, { sources: candidates });
          buffer = buffer.slice(lineEnd + 1);
          metaRead = true;
        }

        if (buffer) {
          answer += buffer;
          buffer = "";
          updateMessage(botId, { text: answer, pending: false });
        }
      }

      // 끝까지 받았는데 글자가 하나도 없으면 오류로 본다.
      if (!answer.trim()) {
        updateMessage(botId, { text: MESSAGE_AI_ERROR, pending: false });
        return;
      }

      // 출처 규칙(PRD M2): 출처를 댈 수 없는 내용은 답변에 넣지 않는다.
      // 정해진 문구가 아닌데, 후보 출처 중 하나도 인용하지 않았다면 근거 없는 답변으로 보고 "확인되지 않는 내용입니다"로 바꾼다.
      const parsed = parseAnswer(answer);
      const citedValid = candidates.some((source) => parsed.citedIds.includes(source.id));
      if (!parsed.isFixed && !citedValid) {
        updateMessage(botId, { text: MESSAGES.NO_SOURCE, sources: [], pending: false });
      }
    } catch (error) {
      // 화면을 떠나 직접 멈춘 경우는 안내를 띄우지 않는다.
      if ((error as Error)?.name === "AbortError") return;
      // 인터넷 끊김, 답변 도중 AI 오류 등. 끊긴 답변은 출처가 없어 근거를 알 수 없으므로 보여주지 않고
      // 오류 안내 문구로 바꾼다. (PRD M2: 출처를 댈 수 없는 내용은 답변에 넣지 않는다)
      updateMessage(botId, { text: MESSAGE_AI_ERROR, sources: undefined, pending: false });
    } finally {
      setAnswering(false);
    }
  }

  return (
    <>
      <FaqButtons onSelect={handleSend} disabled={answering} />
      <div
        className="flex-1 overflow-y-auto bg-[#f4f6f9] px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label="대화 내용"
      >
        <ul className="flex flex-col gap-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={
                message.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] whitespace-pre-wrap break-words rounded bg-[#004a8f] px-4 py-2.5 text-base leading-relaxed text-white"
                    : "max-w-[85%] whitespace-pre-wrap break-words rounded border border-[#d9d9d9] bg-white px-4 py-2.5 text-base leading-relaxed text-[#333]"
                }
              >
                {message.role === "user" ? (
                  message.text
                ) : (
                  <BotBubbleContent message={message} />
                )}
              </div>
            </li>
          ))}
        </ul>
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={answering} remaining={remaining} />
    </>
  );
}
