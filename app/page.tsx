// Design Ref: §3 — 화면은 한 페이지(/)만 있다. 위: 제목·안내, 가운데: 대화, 아래: 입력창과 오늘 남은 질문 수.
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import ChatWindow from "@/components/ChatWindow";
import { DAILY_COOKIE_NAME, parseCount, remainingOf } from "@/lib/dailyLimit";

// 처음 열 때부터 "오늘 남은 질문: N / 20"을 맞게 보여주기 위해, 서버에서 쿠키를 읽어 남은 횟수를 계산한다.
// 이 프로젝트는 cacheComponents 설정이 켜져 있어서, 요청마다 달라지는 값(쿠키)은 <Suspense> 안에서 읽어야 한다.
// (그래서 제목 부분은 미리 만들어 두고, 쿠키가 필요한 대화 영역만 접속할 때 채운다.)
// "오늘 날짜"는 접속할 때마다 달라지는 값이라, 계산하기 전에 connection()으로 "지금 접속 요청이 들어왔을 때 처리"하겠다고 알려 준다.
async function ChatSection() {
  await connection();
  const cookieStore = await cookies();
  const used = parseCount(cookieStore.get(DAILY_COOKIE_NAME)?.value);
  return <ChatWindow initialRemaining={remainingOf(used)} />;
}

export default function Home() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col bg-white shadow-[0_0_0_1px_#d9d9d9]">
      {/* KOICA 홈페이지처럼: 진한 파란 상단 띠 → 흰 헤더(가운데 제목) → 파란 안내 띠 */}
      <div className="bg-[#004a8f] px-4 py-2 text-right text-xs text-white">
        공개된 ODA 자료를 바탕으로 안내합니다
      </div>
      <header className="border-b border-[#d9d9d9] bg-white px-4 py-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[#2a4a8d]">ODA 안내 챗봇</h1>
      </header>
      <p className="bg-[#00469b] px-4 py-2.5 text-center text-sm text-white">
        ODA에 대해 궁금한 점을 물어보세요.
      </p>
      <Suspense fallback={<div className="flex-1" aria-hidden="true" />}>
        <ChatSection />
      </Suspense>
    </main>
  );
}
