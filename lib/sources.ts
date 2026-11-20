// Design Ref: §6 — 챗봇이 읽는 ODA 자료. 데이터베이스 없이 data/oda-sources.json 파일을 그대로 쓴다.
// 자료를 바꾸려면 JSON 파일을 고치고 다시 배포한다.
import data from "@/data/oda-sources.json";

export type OdaSource = {
  id: string; // 조각 번호 (예: S1)
  org: string; // 기관명
  title: string; // 문서명
  url: string; // 원문 주소
  asOf: string; // 자료 기준일 (YYYY-MM-DD)
  asOfKind?: string; // 기준일의 종류 (페이지 업데이트일 / 확인일)
  text: string; // 본문
};

// 화면에 내려보내는 출처 정보. 본문(text)은 빼고 보낸다. (DESIGN §5: 서버 응답 첫 줄의 sources)
export type PublicSource = Omit<OdaSource, "text">;

export function toPublicSource(source: OdaSource): PublicSource {
  const { id, org, title, url, asOf, asOfKind } = source;
  return { id, org, title, url, asOf, asOfKind };
}

export const ODA_SOURCES: readonly OdaSource[] = data;
