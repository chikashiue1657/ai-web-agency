/**
 * 優先度判定（営業 A/B/C + score）。
 *
 * 二段構え:
 *  1) ルールベース一次判定（純関数・LLM不要・説明可能）
 *  2) LLM補正二次判定（任意・失敗時はルールベースを維持）
 *
 * スコアリング設計（0〜100点）:
 *  営業の狙いは「HP未整備で、集客ポテンシャルがあり、改善余地が大きい店」。
 *  - HP無し          : +35  （最重要。本サービスの主対象）
 *  - 口コミ評価が高い : 最大 +15（既に集客力があり投資対効果が高い）
 *  - 口コミ数が多い   : 最大 +15（来客実績・ネット導線価値）
 *  - SNS運用あり      : +10  （集客意欲がある＝提案が刺さりやすい）
 *  - 写真不足         : +8   （訴求改善余地。HP/サイトで補える）
 *  - 観光需要あり業種 : +7   （多言語/予約導線の価値が高い）
 *  - 多言語ニーズ推定 : +5
 *  - 営業時間情報あり : +5   （事業として稼働＝アプローチ価値）
 *
 *  ランク閾値: A >= 70 / B >= 45 / それ未満 C
 */
import type { PriorityRank, StoreCategory } from "@/lib/types";

/** スコアリング入力（正規化済み店舗＋任意の推定シグナル）。 */
export interface ScoringInput {
  category?: StoreCategory | string | null;
  rating?: number | null;
  review_count?: number | null;
  photo_count?: number | null;
  has_website?: boolean | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  area?: string | null;
  opening_hours?: unknown | null;
  /** 店舗概要テキスト（任意） */
  description?: string | null;
  /** 口コミ要約（任意） */
  review_summary?: string | null;
  /** 観光客需要の有無（不明なら未指定→業種から推定） */
  tourist_demand?: boolean | null;
  /** 多言語対応ニーズ（不明なら未指定→推定） */
  multilingual_need?: boolean | null;
}

export interface ScoringResult {
  priority_rank: PriorityRank;
  score: number; // 0〜100
  reasons: string[]; // 加点根拠（説明可能性）
  sales_angle: string; // 営業切り口
  risk_flags: string[]; // 注意点
  /** ルールベースのみか、LLM補正済みか */
  method: "rule" | "rule+llm";
}

/** 観光需要が高いと推定する業種 */
const TOURIST_HEAVY: Array<StoreCategory> = ["restaurant", "cafe", "izakaya", "hotel"];

function rankFromScore(score: number): PriorityRank {
  if (score >= 70) return "A";
  if (score >= 45) return "B";
  return "C";
}

/**
 * ルールベース一次判定（純関数）。
 * LLM不要でここだけで完結する。
 */
export function scoreByRules(input: ScoringInput): ScoringResult {
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 0;

  const category = (input.category as StoreCategory) ?? "other";
  const rating = input.rating ?? null;
  const reviews = input.review_count ?? 0;
  const photos = input.photo_count ?? 0;
  const hasWebsite = input.has_website ?? false;
  const hasSns = !!(input.instagram_url || input.facebook_url);

  // --- HP有無（最重要） ---
  if (!hasWebsite) {
    score += 35;
    reasons.push("ホームページ未整備（本サービスの主対象・改善余地大）");
  } else {
    reasons.push("既存HPあり（リニューアル/集客改善提案に切替が必要）");
  }

  // --- 口コミ評価 ---
  if (rating != null) {
    if (rating >= 4.3) {
      score += 15;
      reasons.push(`高評価(${rating})で集客ポテンシャルが高い`);
    } else if (rating >= 4.0) {
      score += 10;
      reasons.push(`評価良好(${rating})`);
    } else if (rating >= 3.5) {
      score += 5;
      reasons.push(`評価は標準的(${rating})`);
    } else {
      risks.push(`評価が低め(${rating})。改善要因の見極めが必要`);
    }
  } else {
    risks.push("評価データなし（来客実績の確認が必要）");
  }

  // --- 口コミ数 ---
  if (reviews >= 200) {
    score += 15;
    reasons.push(`口コミ多数(${reviews}件)で来客実績が厚い`);
  } else if (reviews >= 50) {
    score += 10;
    reasons.push(`口コミ${reviews}件で一定の集客力`);
  } else if (reviews >= 10) {
    score += 5;
    reasons.push(`口コミ${reviews}件`);
  } else {
    risks.push(`口コミが少ない(${reviews}件)。ネット集客は今後の余地`);
  }

  // --- SNS運用 ---
  if (hasSns) {
    score += 10;
    reasons.push("SNS運用あり（集客意欲が高くHP提案が刺さりやすい）");
  } else {
    reasons.push("SNS未確認（オンライン導線全般を提案できる）");
  }

  // --- 写真不足（訴求改善余地） ---
  if (photos < 5) {
    score += 8;
    reasons.push(`掲載写真が少ない(${photos}枚)。見せ方の改善余地が大きい`);
  }

  // --- 観光需要 ---
  const touristDemand =
    input.tourist_demand ?? TOURIST_HEAVY.includes(category);
  if (touristDemand) {
    score += 7;
    reasons.push("観光客需要が見込める業種/立地（多言語・予約導線の価値大）");
  }

  // --- 多言語ニーズ ---
  const multilingual = input.multilingual_need ?? touristDemand;
  if (multilingual) {
    score += 5;
    reasons.push("多言語対応ニーズが推定される（外国人観光客向け訴求）");
  }

  // --- 稼働シグナル（営業時間） ---
  if (input.opening_hours) {
    score += 5;
    reasons.push("営業時間情報あり（現役稼働店としてアプローチ価値あり）");
  }

  // クランプ
  score = Math.min(100, Math.max(0, Math.round(score)));
  const priority_rank = rankFromScore(score);

  return {
    priority_rank,
    score,
    reasons,
    sales_angle: buildSalesAngle(category, { hasWebsite, hasSns, touristDemand }),
    risk_flags: risks,
    method: "rule",
  };
}

/** 業種・状況から営業切り口テキストを生成（ルールベース）。 */
function buildSalesAngle(
  category: StoreCategory,
  ctx: { hasWebsite: boolean; hasSns: boolean; touristDemand: boolean }
): string {
  const base = ctx.hasWebsite
    ? "既存HPの集客力・予約導線の見直し"
    : "HP新規制作による検索流入と予約導線の確立";

  const byCat: Partial<Record<StoreCategory, string>> = {
    restaurant: "メニュー・口コミ訴求と予約/モバイルオーダー導線",
    cafe: "世界観の可視化とSNS連携での来店動機づくり",
    izakaya: "コース/宴会予約とクーポン導線の整備",
    beauty: "施術メニュー・料金の明確化とネット予約導線",
    clinic: "診療内容・アクセスの信頼訴求とWeb予約/問診導線",
    hotel: "多言語対応と直予約（OTA手数料削減）導線",
    retail: "在庫/商品紹介とオンライン問い合わせ導線",
    other: "強みの言語化とオンライン問い合わせ導線",
  };

  const cat = byCat[category] ?? byCat.other!;
  const tourist = ctx.touristDemand ? "／訪日客向け多言語ページ" : "";
  return `${base}。具体的には${cat}${tourist}を提案。`;
}

/**
 * LLM補正の出力（JSON）。ルールベース結果に上書きマージする。
 * すべて任意（部分上書き）。
 */
export interface LlmScoreAdjustment {
  score_delta?: number; // -20〜+20 程度を想定
  add_reasons?: string[];
  add_risk_flags?: string[];
  sales_angle?: string;
}
