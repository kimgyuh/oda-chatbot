"use client";

// Design Ref: §3 — 입력창과 보내기 버튼, 입력창 가까이에 "개인정보는 입력하지 마세요" 안내.
// 이 파일은 "화면에서 질문을 적는 칸"만 맡는다. 서버 연결은 ChatWindow가 한다. (PLAN 5번)
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { DAILY_LIMIT } from "@/lib/dailyLimit";
import { MESSAGES } from "@/lib/messages";

type ChatInputProps = {
  // 질문을 보낼 때 부르는 함수. 앞뒤 공백을 뺀 글이 넘어온다.
  onSend: (question: string) => void;
  // 답변을 기다리는 동안 등 보내기를 잠시 막을 때 true
  disabled?: boolean;
  // 오늘 남은 질문 수. (PRD: 하루 20개) 값이 있으면 입력창 아래에 보여준다.
  remaining?: number | null;
};

export default function ChatInput({
  onSend,
  disabled = false,
  remaining = null,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  // 빈 칸에서 Enter를 눌렀을 때 "질문을 입력해 주세요." 안내를 보여준다. (Check의 Gap 2, PRD 9번)
  const [showEmptyNotice, setShowEmptyNotice] = useState(false);
  const canSend = !disabled && value.trim().length > 0;

  function send() {
    if (disabled) return;
    if (value.trim().length === 0) {
      setShowEmptyNotice(true);
      return;
    }
    onSend(value.trim());
    setValue("");
    setShowEmptyNotice(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // 한글처럼 글자를 조합하는 중에 누른 Enter는 "보내기"가 아니라 글자 확정이므로 무시한다.
    if (event.nativeEvent.isComposing) return;
    // Enter = 보내기, Shift+Enter = 줄바꿈
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-[#d9d9d9] bg-white px-4 pb-4 pt-3"
    >
      <p className="mb-2 text-xs text-[#666]">
        ※ 개인정보(이름, 전화번호, 이메일 등)는 입력하지 마세요.
      </p>
      <div className="flex items-end gap-2">
        <label htmlFor="question" className="sr-only">
          질문 입력
        </label>
        <textarea
          id="question"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setShowEmptyNotice(false);
          }}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="질문을 입력하세요 (예: ODA가 뭐예요?)"
          className="min-h-[3.25rem] flex-1 resize-none rounded border border-[#b7b7b7] bg-white px-3 py-2 text-base text-[#333] outline-none placeholder:text-[#999] focus:border-[#004a8f] focus:ring-2 focus:ring-[#1f9bde]/30"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="h-[3.25rem] shrink-0 rounded bg-[#004a8f] px-5 text-base font-medium text-white transition-colors hover:bg-[#063c6e] disabled:cursor-not-allowed disabled:bg-[#bdc2cb]"
        >
          보내기
        </button>
      </div>
      {showEmptyNotice && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {MESSAGES.EMPTY_QUESTION}
        </p>
      )}
      {remaining !== null && (
        <p
          className={
            remaining === 0
              ? "mt-2 text-xs font-medium text-red-600"
              : "mt-2 text-xs text-[#666]"
          }
          aria-live="polite"
        >
          오늘 남은 질문: {remaining} / {DAILY_LIMIT}
        </p>
      )}
    </form>
  );
}
