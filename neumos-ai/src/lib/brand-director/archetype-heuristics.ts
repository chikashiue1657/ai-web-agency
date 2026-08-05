/**
 * ルールベース経路（LLM未接続時）向けの決定論的アートディレクション判定。
 *
 * 以前は業種名だけから`brandArchetype`を一意に固定していたため（例:
 * カフェは常に"artisan"）、OpenAI未接続の全店舗が同じ配色・構図・書体に
 * 収束してしまっていた。ここでは業種で「妥当な候補集合」へまず絞り込み、
 * その中でbrief内の自由記述（tone/salesAngle/siteConcept/offer/
 * targetCustomer/storeName/area）をキーワード評価して選ぶ。
 * キーワードが一致しない、または複数候補が同点の場合のみ、
 * `deterministic-hash.ts`の安定ハッシュでtie-breakする（Math.random等の
 * 非決定的な値は一切使わない）。
 *
 * 業種ごとの妥当集合を超えて選ばれることは無い（例: 居酒屋が
 * "wellness-calm"になることはない）ため、既存の`archetypeForIndustry`が
 * 保証していた「業種との整合性」は引き続き保たれる。
 */
import type { IndustryCategory } from "@/lib/engine/industry";
import { classifyIndustry } from "@/lib/engine/industry";
import { hashToIndex } from "@/lib/engine/deterministic-hash";
import type { StoreBrief } from "@/lib/types";
import type { BrandArchetype } from "./types";

export type PaletteHint = "warm" | "cool" | "neutral" | "high-contrast";

export interface ArchetypeDecision {
  archetype: BrandArchetype;
  paletteHint: PaletteHint;
  /** 選ばれたarchetypeの根拠になった、brief内で実際に一致したキーワード。 */
  matchedKeywords: string[];
  /** キーワード一致が1件も無く、業種の妥当集合からハッシュだけで選んだ場合true。 */
  usedFallback: boolean;
}

/**
 * 業種ごとに「不自然に見えない」archetypeの候補集合。
 * 各配列の先頭は、旧`archetypeForIndustry`が返していた値と同じにしてある
 * （brief内容にキーワード的な手がかりが一切無い場合の既定挙動を、
 * 従来の見た目からなるべく連続させるため）。
 */
export const PLAUSIBLE_ARCHETYPES_BY_INDUSTRY: Record<IndustryCategory, readonly BrandArchetype[]> = {
  cafe: ["artisan", "warm-hospitality", "modern-minimal", "heritage-traditional", "wellness-calm"],
  hair_salon: ["modern-minimal", "energetic-casual", "luxury-quiet", "warm-hospitality"],
  spa: ["wellness-calm", "luxury-quiet", "modern-minimal"],
  izakaya: ["energetic-casual", "warm-hospitality", "heritage-traditional"],
  hotel: ["luxury-quiet", "heritage-traditional", "wellness-calm"],
  general: [
    "warm-hospitality",
    "artisan",
    "modern-minimal",
    "luxury-quiet",
    "energetic-casual",
    "heritage-traditional",
    "wellness-calm",
  ],
};

const ARCHETYPE_KEYWORDS: Record<BrandArchetype, readonly string[]> = {
  artisan: ["手仕事", "自家製", "自家焙煎", "丁寧", "クラフト", "職人", "手作り", "一杯ずつ", "こだわりの製法"],
  "modern-minimal": ["シンプル", "ミニマル", "洗練", "無駄のない", "モダン", "スタイリッシュ", "都会的", "スマート"],
  "warm-hospitality": ["温かい", "あたたかい", "おもてなし", "家庭的", "居心地", "アットホーム", "ほっと", "寄り添う"],
  "luxury-quiet": ["高級", "上質", "特別な", "ラグジュアリー", "静寂", "プライベート", "上品", "非日常", "贅沢"],
  "energetic-casual": ["元気", "カジュアル", "賑やか", "楽しい", "気軽", "ワイワイ", "フレンドリー", "盛り上がる"],
  "heritage-traditional": ["伝統", "老舗", "歴史", "受け継", "昔ながら", "創業", "こだわり抜いた技", "代々"],
  "wellness-calm": ["癒し", "リラックス", "健康", "穏やか", "ゆったり", "安らぎ", "整える", "静かな時間"],
};

const PALETTE_KEYWORDS: Record<PaletteHint, readonly string[]> = {
  warm: ["温かい", "あたたかい", "ぬくもり", "木", "手仕事", "アンバー", "土", "素朴", "太陽"],
  cool: ["クール", "都会的", "スタイリッシュ", "モノトーン", "涼しげ", "洗練された空間", "ガラス"],
  neutral: ["シンプル", "ナチュラル", "落ち着いた", "控えめ", "自然体", "上質"],
  "high-contrast": ["モダン", "エッジ", "インパクト", "力強い", "ダイナミック", "大胆", "刺激的"],
};

function buildSearchText(brief: StoreBrief): string {
  return [brief.tone, brief.salesAngle, brief.siteConcept, brief.offer, brief.targetCustomer, brief.storeName, brief.area]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" ");
}

interface KeywordPick<T extends string> {
  choice: T;
  matched: string[];
  usedFallback: boolean;
}

/**
 * `candidates`の中から、`searchText`に含まれるキーワード数が最多のものを選ぶ
 * 共通ロジック（アートディレクション判定・パレット判定の両方から使う）。
 * 最多スコアが0件（＝一致するキーワードが無い）、または複数候補が同点の場合は、
 * `seed`から導く安定ハッシュで候補内から決定論的に1つへ絞る。
 */
function pickByKeywordScore<T extends string>(
  searchText: string,
  keywordsByOption: Record<T, readonly string[]>,
  candidates: readonly T[],
  seed: string
): KeywordPick<T> {
  const scored = candidates.map((option) => {
    const matched = keywordsByOption[option].filter((kw) => searchText.includes(kw));
    return { option, score: matched.length, matched };
  });

  const maxScore = Math.max(...scored.map((s) => s.score));
  const usedFallback = maxScore === 0;
  const winners = usedFallback ? candidates : scored.filter((s) => s.score === maxScore).map((s) => s.option);

  const choice = winners.length === 1 ? winners[0] : winners[hashToIndex(seed, winners.length)];
  const matched = usedFallback ? [] : scored.find((s) => s.option === choice)?.matched ?? [];

  return { choice, matched, usedFallback };
}

/**
 * briefから決定論的にアートディレクション（archetype）とパレットを導く。
 * `seed`には呼び出し側で安定した文字列（例: `${storeName}:${area}`）を渡す。
 * 同じ`brief`・同じ`seed`なら常に同じ結果を返す。
 */
export function deriveArchetypeDecision(brief: StoreBrief, seed: string): ArchetypeDecision {
  const category = classifyIndustry(brief.industry);
  const candidates = PLAUSIBLE_ARCHETYPES_BY_INDUSTRY[category];
  const searchText = buildSearchText(brief);

  const archetypePick = pickByKeywordScore(searchText, ARCHETYPE_KEYWORDS, candidates, `${seed}:archetype`);
  const palettePick = pickByKeywordScore(
    searchText,
    PALETTE_KEYWORDS,
    ["warm", "cool", "neutral", "high-contrast"] as const,
    `${seed}:palette`
  );

  return {
    archetype: archetypePick.choice,
    paletteHint: palettePick.choice,
    matchedKeywords: [...archetypePick.matched, ...palettePick.matched],
    usedFallback: archetypePick.usedFallback,
  };
}
