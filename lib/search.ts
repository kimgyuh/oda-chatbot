// Design Ref: §4 — 6단계 "자료에서 관련 조각 찾기". 자료가 수십 건 이하라 복잡한 검색 장치(벡터 DB) 없이
// "질문과 겹치는 낱말이 많은 자료 조각"을 점수로 골라낸다. (DESIGN §7: 간단한 낱말 비교)
//
// 이 파일은 외부 도구에 기대지 않는 순수 코드라서, 자동 시험(PLAN 12번)에서 그대로 시험할 수 있다.

export type Searchable = {
  id: string;
  org: string;
  title: string;
  text: string;
};

// ── 조절 값 ───────────────────────────────────────────────
// 한 번에 AI에게 줄 자료 조각 수. 많을수록 정확하지만 비용·응답 시간이 늘어난다.
const MAX_RESULTS = 4;
// 이 점수 미만이면 "관련 자료 없음"으로 본다. (질문과 자료가 거의 겹치지 않는 경우)
const MIN_SCORE = 3.5;
// 1등 점수의 이 비율 미만인 조각은 버린다. (관련 없는 조각이 끼어드는 것을 줄임)
const RELATIVE_CUTOFF = 0.4;
// 영문 이름(ODA, KOICA 등)은 고유한 표지라서 한글 두 글자 조각보다 비중을 더 둔다.
const LATIN_BOOST = 3;
// 제목에 들어 있는 한글 낱말의 점수 배수.
const TITLE_BOOST = 2;
// 조각의 절반 넘게 나오는 낱말은 구별하는 힘이 약하므로 한글 조각에서는 무시한다. ("있습니다" 같은 말투)
const COMMON_RATIO = 0.5;

// 질문을 "낱말 조각"으로 쪼갠다.
//  - 영문·숫자 낱말: 그대로 (소문자로 통일)   예) "KOICA" → "koica"
//  - 한글: 연속된 두 글자씩 겹쳐서 자른다      예) "추진체계" → "추진", "진체", "체계"
// 한국어는 "ODA가", "KOICA는"처럼 조사가 붙어도 두 글자씩 자르면 핵심 낱말이 그대로 남아서 비교가 쉽다.
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();

  for (const match of lower.matchAll(/[a-z0-9]{2,}/g)) {
    tokens.add(match[0]);
  }
  for (const match of lower.matchAll(/[가-힣]+/g)) {
    const run = match[0];
    for (let i = 0; i < run.length - 1; i++) {
      tokens.add(run.slice(i, i + 2));
    }
  }
  return tokens;
}

function isLatin(token: string): boolean {
  return /^[a-z0-9]+$/.test(token);
}

type Index = {
  tokensByDoc: Set<string>[];
  // 각 조각의 "제목"에 있는 낱말. (예: 제목이 "…국별현황 > 페루"인 조각은 "페루"를 물을 때 먼저 골라야 한다)
  titleTokensByDoc: Set<string>[];
  // 영문 낱말이 각 조각에 몇 번 나오는지. ("ODA"만 물어보면 ODA를 가장 많이 설명하는 조각을 먼저 고르기 위함)
  latinCountsByDoc: Map<string, number>[];
  docFrequency: Map<string, number>;
};

function countLatin(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of text.toLowerCase().matchAll(/[a-z0-9]{2,}/g)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  return counts;
}

// 같은 자료 목록은 한 번만 색인(낱말 정리)해서 재사용한다.
const indexCache = new WeakMap<readonly Searchable[], Index>();

function getIndex(sources: readonly Searchable[]): Index {
  const cached = indexCache.get(sources);
  if (cached) return cached;

  const docFrequency = new Map<string, number>();
  const latinCountsByDoc: Map<string, number>[] = [];
  const titleTokensByDoc = sources.map((source) => tokenize(source.title));
  const tokensByDoc = sources.map((source) => {
    // 제목과 기관명에도 핵심 낱말이 있으므로 본문과 함께 비교한다.
    const fullText = `${source.org} ${source.title} ${source.text}`;
    const tokens = tokenize(fullText);
    latinCountsByDoc.push(countLatin(fullText));
    for (const token of tokens) {
      docFrequency.set(token, (docFrequency.get(token) ?? 0) + 1);
    }
    return tokens;
  });

  const index = { tokensByDoc, titleTokensByDoc, latinCountsByDoc, docFrequency };
  indexCache.set(sources, index);
  return index;
}

export type SearchResult<T extends Searchable> = {
  source: T;
  score: number;
};

// 질문과 관련 있는 자료 조각을 점수 높은 순으로 최대 MAX_RESULTS개 돌려준다.
// 관련 있는 조각이 없으면 빈 목록이다. → 호출하는 쪽에서 "확인되지 않는 내용입니다"로 답한다.
export function searchSources<T extends Searchable>(
  question: string,
  sources: readonly T[]
): SearchResult<T>[] {
  if (sources.length === 0) return [];

  const { tokensByDoc, titleTokensByDoc, latinCountsByDoc, docFrequency } = getIndex(sources);
  const total = sources.length;
  const questionTokens = tokenize(question);

  const scored = sources.map((source, i) => {
    let score = 0;
    for (const token of questionTokens) {
      const df = docFrequency.get(token);
      if (!df || !tokensByDoc[i].has(token)) continue;

      const latin = isLatin(token);
      if (!latin && df / total > COMMON_RATIO) continue;

      // 적은 조각에만 나오는 낱말일수록 점수를 높게 준다.
      const weight = Math.log(1 + total / df);
      if (latin) {
        // 영문 낱말은 조각 안에서 여러 번 나올수록 그 조각이 그 낱말을 중심으로 설명한다고 본다.
        const timesInDoc = latinCountsByDoc[i].get(token) ?? 1;
        score += weight * LATIN_BOOST * (1 + Math.log(timesInDoc));
      } else {
        // 제목에 있는 낱말(예: 나라 이름)은 본문에만 있는 낱말보다 질문의 주제일 가능성이 높아 점수를 더 준다.
        score += titleTokensByDoc[i].has(token) ? weight * TITLE_BOOST : weight;
      }
    }
    return { source, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  if (top < MIN_SCORE) return [];

  return scored
    .filter((item) => item.score >= MIN_SCORE && item.score >= top * RELATIVE_CUTOFF)
    .slice(0, MAX_RESULTS);
}
