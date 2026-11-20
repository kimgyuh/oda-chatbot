// Design Ref: §3 — (선택 기능 N1) 자주 묻는 질문 버튼 5개. 누르면 그 질문이 바로 전송된다.
// 질문을 고칠 때는 자료(data/oda-sources.json)에 답이 있는 질문인지, 자동 시험(tests/faq.test.ts)이 통과하는지 함께 확인한다.
export const FAQ_QUESTIONS: readonly string[] = [
  "ODA가 뭐예요?",
  "유상원조와 무상원조는 뭐가 달라요?",
  "우리나라 ODA 추진체계는 어떻게 돼 있어요?",
  "KOICA는 어떤 사업들을 하나요?",
  "2024년 우리나라 ODA 지원 규모는 얼마였어요?",
];
