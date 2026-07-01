/**
 * Thinking Engine（店舗診断）。
 *
 * 役割:
 *  - 店舗情報＋優先度＋提案書から StoreStrategy を導く（ルールベース・純関数）。
 *  - 強み/弱み/集客課題/HP必要性/SNS改善/GBP改善/差別化/ターゲット/受注確率/
 *    営業切り口/おすすめ提案 を診断し、ノイモス受け渡し核(generationBrief)まで作る。
 *  - LLM不要でここだけで完結（strategy-llm.ts で任意の補正）。
 *  - 実データのみ断定、欠損は「（仮説）」明示（捏造防止）。
 */
import type {
  Store,
  Lead,
  Proposal,
  StoreCategory,
  StoreStrategy,
  NeumosBriefBase,
} from "@/lib/types";

export const STRATEGY_VERSION = "1.0";

const CATEGORY_LABEL: Record<StoreCategory, string> = {
  restaurant: "飲食店",
  cafe: "カフェ",
  izakaya: "居酒屋",
  beauty: "美容サロン",
  clinic: "クリニック",
  hotel: "宿泊施設",
  retail: "ショップ",
  other: "店舗",
};

interface CatProfile {
  concept: string;
  goal: string;
  tone: string;
  pages: string[];
  offer: string;
}

const CAT_PROFILE: Record<StoreCategory, CatProfile> = {
  restaurant: {
    concept: "料理の魅力と来店体験が伝わる、予約につながるサイト",
    goal: "Web経由の予約・来店の獲得",
    tone: "温かみと食欲をそそる、信頼感のあるトーン",
    pages: ["TOP", "店舗紹介", "メニュー", "アクセス", "FAQ", "予約・問い合わせ"],
    offer: "ホームページ新規制作＋ネット予約導線の整備",
  },
  cafe: {
    concept: "世界観と居心地が伝わる、来店動機を作るサイト",
    goal: "来店動機の醸成とSNS連携",
    tone: "やわらかく親しみやすい、映えるトーン",
    pages: ["TOP", "店舗紹介", "メニュー", "アクセス", "FAQ", "問い合わせ"],
    offer: "ホームページ制作＋SNS連携による来店導線",
  },
  izakaya: {
    concept: "コース・宴会の魅力が伝わり、予約が取れるサイト",
    goal: "コース/宴会予約の獲得",
    tone: "activeで賑わいを感じる、安心感のあるトーン",
    pages: ["TOP", "店舗紹介", "コース・メニュー", "アクセス", "FAQ", "予約"],
    offer: "ホームページ制作＋宴会予約/クーポン導線",
  },
  beauty: {
    concept: "施術メニューと仕上がりが伝わり、指名予約が入るサイト",
    goal: "ネット予約・指名の獲得",
    tone: "清潔感と上質さを感じるトーン",
    pages: ["TOP", "店舗紹介", "メニュー・料金", "アクセス", "FAQ", "予約"],
    offer: "ホームページ制作＋ネット予約導線の整備",
  },
  clinic: {
    concept: "診療内容と安心感が伝わり、Web予約につながるサイト",
    goal: "Web予約・問い合わせと信頼構築",
    tone: "誠実で落ち着いた、信頼できるトーン",
    pages: ["TOP", "診療案内", "院長・スタッフ紹介", "アクセス", "FAQ", "予約・問い合わせ"],
    offer: "ホームページ制作＋Web予約/問診導線の整備",
  },
  hotel: {
    concept: "施設の魅力と予約導線が整った、直予約を促すサイト",
    goal: "公式サイトからの直予約（OTA手数料削減）",
    tone: "上質で開放的な、旅の期待を高めるトーン",
    pages: ["TOP", "施設紹介", "客室・プラン", "アクセス", "FAQ", "予約・問い合わせ"],
    offer: "ホームページ制作＋多言語/直予約導線",
  },
  retail: {
    concept: "商品と専門性が伝わり、来店・問い合わせにつながるサイト",
    goal: "来店・オンライン問い合わせの獲得",
    tone: "分かりやすく信頼できるトーン",
    pages: ["TOP", "店舗紹介", "取扱商品", "アクセス", "FAQ", "問い合わせ"],
    offer: "ホームページ制作＋商品紹介/問い合わせ導線",
  },
  other: {
    concept: "強みが伝わり、問い合わせにつながるサイト",
    goal: "問い合わせ・来店の獲得",
    tone: "中立で信頼感のあるトーン",
    pages: ["TOP", "店舗紹介", "サービス", "アクセス", "FAQ", "問い合わせ"],
    offer: "ホームページ制作＋オンライン問い合わせ導線",
  },
};

const TOURIST_HEAVY: StoreCategory[] = ["restaurant", "cafe", "izakaya", "hotel"];

export interface DiagnoseInput {
  store: Store;
  lead?: Lead | null;
  proposal?: Proposal | null;
  reviewSummary?: string | null;
}

/**
 * 店舗を診断して StoreStrategy を返す（純関数・決定的）。
 * id/created_at 等はDB採番のため呼び出し側で補完（ここでは空文字/現在時刻の雛形）。
 */
export function diagnoseStore(input: DiagnoseInput): StoreStrategy {
  const { store, lead, proposal } = input;
  const category = (store.category as StoreCategory) ?? "other";
  const label = CATEGORY_LABEL[category] ?? "店舗";
  const profile = CAT_PROFILE[category] ?? CAT_PROFILE.other;
  const area = store.area ?? "沖縄";
  const tourist = TOURIST_HEAVY.includes(category);
  const hasSns = !!(store.instagram_url || store.facebook_url);

  // --- 強み ---
  const strengths: string[] =
    proposal?.opportunities && proposal.opportunities.length > 0
      ? [...proposal.opportunities]
      : [];
  if (strengths.length === 0) {
    if (store.rating != null && store.rating >= 4.0)
      strengths.push(`Googleマップ評価${store.rating}と高評価で来店満足度が高い`);
    if (store.review_count >= 50)
      strengths.push(`口コミ${store.review_count}件と来店実績が厚い`);
    if (hasSns) strengths.push("SNS運用による発信力・Web集客の素地");
    if (strengths.length === 0) strengths.push("（仮説）地域での営業実績（要ヒアリング）");
  }

  // --- 弱み / 集客課題 ---
  const weaknesses: string[] = [];
  const marketingProblems: string[] = [];
  if (!store.has_website) {
    weaknesses.push("公式ホームページが無い");
    marketingProblems.push("店名以外の検索（エリア×業種）から新規客を取りこぼしている");
    marketingProblems.push("Web予約・問い合わせ導線が無く機会損失が発生している");
  } else {
    weaknesses.push("既存サイトの予約導線・スマホ最適化に改善余地（仮説）");
    marketingProblems.push("既存Web導線の予約転換に改善余地がある可能性");
  }
  if (store.photo_count < 5) {
    weaknesses.push(`掲載写真が${store.photo_count}枚と少ない`);
    marketingProblems.push("写真不足で魅力が十分に伝わっていない");
  }
  if (!hasSns) {
    weaknesses.push("SNS未活用（仮説）");
    marketingProblems.push("（仮説）SNS未活用でリピート・拡散の導線が弱い");
  }
  if (store.rating != null && store.rating < 3.5)
    weaknesses.push(`評価が低め(${store.rating})で改善要因の見極めが必要`);

  // --- HP必要性 ---
  const websiteNecessity = store.has_website
    ? "既にサイトはあるが、予約導線・スマホ最適化の見直し余地が大きい（リニューアル提案）。"
    : `「${area} ${label}」等の検索流入と24時間予約を取りこぼしており、ホームページの新規制作価値が高い。`;

  // --- SNS改善点 ---
  const snsImprovements: string[] = [];
  if (store.instagram_url) snsImprovements.push("Instagramとサイトの相互導線（プロフィールにサイトリンク／サイトに最新投稿）");
  else snsImprovements.push("Instagram開設・運用で来店前の世界観訴求を強化");
  if (!store.facebook_url) snsImprovements.push("（仮説）Facebook/地域コミュニティ活用の余地");
  snsImprovements.push("投稿→予約への導線設計（ハイライト/固定投稿にメニュー・予約）");

  // --- Googleビジネス改善点 ---
  const googleBusinessImprovements: string[] = [];
  if (store.photo_count < 10)
    googleBusinessImprovements.push("写真点数の拡充（外観・内観・メニュー/施術例）");
  if (store.review_count < 50)
    googleBusinessImprovements.push("口コミ獲得の仕組み化（来店客への依頼フロー）");
  googleBusinessImprovements.push("営業時間・属性・最新情報の整備と投稿の定期運用");
  if (!store.website_url)
    googleBusinessImprovements.push("プロフィールに公式サイトURLを設定し回遊を作る");

  // --- 差別化 ---
  const differentiation = strengths.length
    ? `「${strengths[0]}」を軸に、${label}としての体験価値を明確化して競合と差別化する（仮説含む・要ヒアリング）。`
    : `${label}としての強みを言語化し差別化する（要ヒアリング）。`;

  // --- ターゲット ---
  const targetCustomer = `${area}周辺の地域客${tourist ? "＋観光客（訪日客含む）" : ""}（仮説：要ヒアリングで確定）`;

  // --- 営業切り口 / おすすめ提案 ---
  const salesAngle =
    lead?.sales_angle?.trim() ||
    (store.has_website
      ? "既存サイトの予約導線・集客力の見直し提案"
      : `HP新規制作による検索流入と予約導線の確立提案（${profile.goal}）`);
  const recommendedOffer = profile.offer;

  // --- 推奨ページ / コンセプト ---
  const recommendedPages = proposal?.suggested_sections?.length
    ? proposal.suggested_sections
    : profile.pages;
  const websiteConcept = profile.concept;
  const websiteGoal = profile.goal;
  const tone = profile.tone;

  // --- SEOキーワード ---
  const seoKeywords = dedupe([
    `${area} ${label}`,
    `${area} ${label} おすすめ`,
    `${area} ${label} 予約`,
    tourist ? `${area} ${label} 観光` : `${area} ${label} 人気`,
    store.name,
  ]);

  // --- 優先度の根拠 ---
  const priorityRationale = buildPriorityRationale(store, lead);

  // --- 受注確率 ---
  const confidenceScore = computeConfidence(store, lead, hasSns);

  // --- ノイモス受け渡し核（generationType非依存） ---
  const generationBrief: NeumosBriefBase = {
    storeName: store.name,
    industry: label,
    area,
    targetCustomer,
    mainProblem: marketingProblems[0] ?? "Web集客導線の不足（要確認）",
    salesAngle,
    websiteGoal,
    siteConcept: websiteConcept,
    recommendedPages,
    seoKeywords,
    tone,
    offer: recommendedOffer,
  };

  const now = new Date().toISOString();
  return {
    id: "",
    storeId: store.id,
    strengths,
    weaknesses,
    targetCustomer,
    marketingProblems,
    recommendedOffer,
    salesAngle,
    websiteConcept,
    seoKeywords,
    generationBrief,
    confidenceScore,
    websiteNecessity,
    snsImprovements,
    googleBusinessImprovements,
    differentiation,
    recommendedPages,
    priorityRationale,
    websiteGoal,
    tone,
    method: "rule",
    created_at: now,
    updated_at: now,
  };
}

function buildPriorityRationale(store: Store, lead?: Lead | null): string {
  if (lead?.reasons && lead.reasons.length > 0) {
    const rank = lead.priority_rank ?? "-";
    return `優先度${rank}（スコア${lead.score ?? "-"}）の主因: ${lead.reasons.slice(0, 3).join(" / ")}`;
  }
  const bits: string[] = [];
  if (!store.has_website) bits.push("HP未整備で改善余地大");
  if (store.rating != null && store.rating >= 4.2) bits.push(`高評価(${store.rating})`);
  if (store.review_count >= 50) bits.push(`口コミ${store.review_count}件`);
  return bits.length
    ? `未判定（推定根拠: ${bits.join(" / ")}）。優先度判定の実行を推奨。`
    : "優先度は未判定。まず優先度判定を実行してください。";
}

/** 受注確率(0-100)。説明可能なルールで算出。 */
function computeConfidence(store: Store, lead: Lead | null | undefined, hasSns: boolean): number {
  let c = 40;
  if (!store.has_website) c += 20; // 主対象で刺さりやすい
  if (store.rating != null && store.rating >= 4.2) c += 10;
  if (store.review_count >= 50) c += 10;
  if (hasSns) c += 10; // Web意欲がある
  if (store.photo_count < 5) c += 5; // 改善提案が響く
  if (lead?.priority_rank === "A") c += 10;
  else if (lead?.priority_rank === "B") c += 5;
  return Math.max(0, Math.min(100, Math.round(c)));
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}
