"use client";

// Design Ref: §3 — (선택 기능 N1) 자주 묻는 질문 버튼. 누르면 그 질문이 바로 전송된다.
import { FAQ_QUESTIONS } from "@/lib/faq";

type FaqButtonsProps = {
  // 버튼을 눌렀을 때 질문을 보내는 함수
  onSelect: (question: string) => void;
  // 답변을 기다리는 동안에는 버튼을 막는다.
  disabled?: boolean;
};

export default function FaqButtons({ onSelect, disabled = false }: FaqButtonsProps) {
  return (
    <section
      aria-label="자주 묻는 질문"
      className="border-b border-[#d9d9d9] bg-white px-4 py-2"
    >
      <p className="mb-1.5 text-xs font-bold text-[#2a4a8d]">자주 묻는 질문</p>
      {/* 좁은 화면에서는 옆으로 밀어서 볼 수 있게 한 줄로 둔다. */}
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:#a1a1aa_transparent]">
        {FAQ_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="shrink-0 rounded border border-[#c9d3e0] bg-white px-3 py-1.5 text-sm text-[#333] transition-colors hover:border-[#004a8f] hover:text-[#004a8f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}
