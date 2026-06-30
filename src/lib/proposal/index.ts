/**
 * 営業提案書生成（Markdown）。
 *
 * 方針:
 *  - テンプレートベースで「実在情報のみ」から組み立てる純関数を基本とする。
 *  - 不明な点は断定せず「（仮説）」と明記する（捏造防止＝重要原則）。
 *  - 業種ごとに文脈差分（予約導線/多言語/信頼訴求 等）を反映。
 *  - LLMがあれば文章を磨く補正を任意で行う（proposal/llm.ts）。
 */
import type { Store, StoreCategory } from "@/lib/types";
import type { ScoringResult } from "@/lib/scoring";

/** 提案書の構造化結果（DBの proposals 各カラムに対応）。 */
export interface ProposalResult {
  summary: string; // オーナー向け5分要約
  problems: string[]; // 現状の機会損失
  opportunities: string[]; // 機会・強み
  suggested_sections: string[]; // 推奨ページ構成
  sales_message: string; // 簡易営業メッセージ
  generated_markdown: string; // 提案書本文
}

/** 業種別の提案文脈。拡張しやすいようテーブル化。 */
interface CategoryContext {
  label: string;
  strengths: string[];
  bookingPoint: string;
  foreignerNote: string;
  sections: string[];
}

const CATEGORY_CONTEXT: Record<StoreCategory, CategoryContext> = {
  restaurant: {
    label: "飲食店",
    strengths: ["料理・メニューの魅力", "口コミ評価", "立地"],
    bookingPoint: "ネット予約・モバイルオーダー・テイクアウト導線の整備",
    foreignerNote: "多言語メニューと地図・アクセス案内で訪日客の取りこぼしを防ぐ",
    sections: ["TOP", "店舗紹介", "メニュー", "アクセス", "FAQ", "予約・問い合わせ"],
  },
  cafe: {
    label: "カフェ",
    strengths: ["空間・世界観", "写真映え", "メニュー"],
    bookingPoint: "営業時間・混雑状況・SNS連携での来店動機づくり",
    foreignerNote: "メニューとアクセスの多言語化で観光導線に乗せる",
    sections: ["TOP", "店舗紹介", "メニュー", "アクセス", "FAQ", "問い合わせ"],
  },
  izakaya: {
    label: "居酒屋",
    strengths: ["コース・宴会対応", "雰囲気", "口コミ"],
    bookingPoint: "コース/宴会のネット予約とクーポン導線",
    foreignerNote: "多言語メニューと支払い方法の明示で訪日客に対応",
    sections: ["TOP", "店舗紹介", "コース・メニュー", "アクセス", "FAQ", "予約"],
  },
  beauty: {
    label: "美容サービス",
    strengths: ["技術・施術メニュー", "口コミ評価", "スタッフ"],
    bookingPoint: "メニュー・料金の明確化とネット予約導線",
    foreignerNote: "メニュー/料金の多言語表記で観光客の単発利用を取り込む",
    sections: ["TOP", "店舗紹介", "メニュー・料金", "アクセス", "FAQ", "予約"],
  },
  clinic: {
    label: "医療機関",
    strengths: ["診療内容", "アクセス", "信頼性"],
    bookingPoint: "Web予約・問診・診療時間の明確化",
    foreignerNote: "対応言語・保険可否の明記で安心感を提供",
    sections: ["TOP", "診療案内", "院長・スタッフ紹介", "アクセス", "FAQ", "予約・問い合わせ"],
  },
  hotel: {
    label: "宿泊施設",
    strengths: ["客室・設備", "立地", "口コミ"],
    bookingPoint: "公式サイトからの直予約（OTA手数料削減）導線",
    foreignerNote: "多言語ページと予約フローで訪日客の直予約を最大化",
    sections: ["TOP", "施設紹介", "客室・プラン", "アクセス", "FAQ", "予約・問い合わせ"],
  },
  retail: {
    label: "小売店",
    strengths: ["商品ラインナップ", "立地", "専門性"],
    bookingPoint: "商品紹介とオンライン問い合わせ・取り置き導線",
    foreignerNote: "免税対応・取扱商品の多言語紹介",
    sections: ["TOP", "店舗紹介", "取扱商品", "アクセス", "FAQ", "問い合わせ"],
  },
  other: {
    label: "店舗",
    strengths: ["サービス内容", "立地", "口コミ"],
    bookingPoint: "サービス紹介とオンライン問い合わせ導線",
    foreignerNote: "サービス内容の多言語紹介で来訪客に対応",
    sections: ["TOP", "店舗紹介", "サービス", "アクセス", "FAQ", "問い合わせ"],
  },
};

function ctxOf(category: string | null | undefined): CategoryContext {
  return CATEGORY_CONTEXT[(category as StoreCategory) ?? "other"] ?? CATEGORY_CONTEXT.other;
}

export interface BuildProposalInput {
  store: Pick<
    Store,
    | "name"
    | "category"
    | "area"
    | "address"
    | "rating"
    | "review_count"
    | "photo_count"
    | "has_website"
    | "instagram_url"
    | "facebook_url"
  >;
  scoring?: Pick<ScoringResult, "priority_rank" | "score" | "sales_angle"> | null;
  /** 口コミ要約（任意・あれば反映、無ければ仮説扱い） */
  review_summary?: string | null;
  /** 想定顧客層（任意） */
  target_audience?: string | null;
}

/**
 * 提案書をルールベースで生成（純関数・LLM不要）。
 * 取得済みの実データのみを断定的に書き、欠損は「（仮説）」と明示。
 */
export function buildProposal(input: BuildProposalInput): ProposalResult {
  const { store } = input;
  const ctx = ctxOf(store.category);
  const hasSns = !!(store.instagram_url || store.facebook_url);
  const area = store.area ?? "（エリア不明）";
  const hypo = "（仮説）";

  // --- 強み（実データ＋仮説の切り分け） ---
  const opportunities: string[] = [];
  if (store.rating != null && store.rating >= 4.0)
    opportunities.push(`Googleマップ評価が${store.rating}と高く、来店者の満足度が高い`);
  if ((store.review_count ?? 0) >= 50)
    opportunities.push(`口コミ${store.review_count}件と来客実績が厚く、ネット集客の素地がある`);
  if (hasSns) opportunities.push("SNSを運用しており、Web集客への意欲・素地がある");
  if (opportunities.length === 0)
    opportunities.push(`${hypo}${ctx.strengths[0]}に強みがある可能性（要ヒアリング）`);

  // --- 機会損失（課題） ---
  const problems: string[] = [];
  if (!store.has_website) {
    problems.push("公式ホームページが無く、店名以外の検索流入を取りこぼしている");
    problems.push("予約・問い合わせがGoogleマップ/電話に限られ、機会損失が発生している");
  } else {
    problems.push("既存サイトの予約導線・スマホ最適化に改善余地がある可能性");
  }
  if ((store.photo_count ?? 0) < 5)
    problems.push(`掲載写真が${store.photo_count ?? 0}枚と少なく、魅力が十分に伝わっていない`);
  if (!hasSns) problems.push(`${hypo}SNS未活用で、リピート・拡散の導線が弱い可能性`);

  // --- 推奨ページ構成 ---
  const suggested_sections = ctx.sections;

  // --- 簡易営業メッセージ ---
  const sales_message = buildSalesMessage(store.name, ctx, area, store.has_website);

  // --- オーナー向け5分要約 ---
  const summary = buildSummary(store.name, ctx, store.has_website, input.scoring ?? null);

  const generated_markdown = renderMarkdown({
    input,
    ctx,
    area,
    opportunities,
    problems,
    suggested_sections,
    sales_message,
    summary,
  });

  return {
    summary,
    problems,
    opportunities,
    suggested_sections,
    sales_message,
    generated_markdown,
  };
}

function buildSalesMessage(
  name: string,
  ctx: CategoryContext,
  area: string,
  hasWebsite: boolean
): string {
  const lead = hasWebsite
    ? `${name}様のWeb集客、もっと予約につなげませんか？`
    : `${name}様、Googleマップの評価を“予約”に変えるホームページを作りませんか？`;
  return `${lead} ${area}の${ctx.label}として、${ctx.bookingPoint}を中心に、最短で集客改善できる構成をご提案します。まずは無料で仮サイトのデモをご覧ください。`;
}

function buildSummary(
  name: string,
  ctx: CategoryContext,
  hasWebsite: boolean,
  scoring: BuildProposalInput["scoring"]
): string {
  const rank = scoring?.priority_rank ? `（営業優先度: ${scoring.priority_rank}）` : "";
  const core = hasWebsite
    ? "既存のWeb導線を見直し、予約・問い合わせの取りこぼしを減らす提案です。"
    : "ホームページが無いことで生じている検索・予約の機会損失を解消する提案です。";
  return `${name}様向け提案要約${rank}：${core} ${ctx.label}に最適化したページ構成（${ctx.sections.join("・")}）と、${ctx.bookingPoint}を整え、Googleマップの評価を来店・予約に転換します。費用対効果と次のアクションを5分でご説明します。`;
}

function renderMarkdown(args: {
  input: BuildProposalInput;
  ctx: CategoryContext;
  area: string;
  opportunities: string[];
  problems: string[];
  suggested_sections: string[];
  sales_message: string;
  summary: string;
}): string {
  const { input, ctx, area, opportunities, problems, suggested_sections, sales_message, summary } = args;
  const s = input.store;
  const ratingLine =
    s.rating != null ? `${s.rating}（口コミ ${s.review_count ?? 0}件）` : "データなし（要確認）";
  const reviewSummary =
    input.review_summary ?? "（仮説）口コミ内容は未取得。ヒアリングで具体化を推奨。";
  const audience = input.target_audience ?? `${area}周辺の地域客＋観光客（仮説）`;

  return `# ${s.name} 様 ご提案書

> 本提案書はGoogleマップ等の公開情報をもとに自動生成しています。**事実が確認できない項目は「（仮説）」と明記**しています。実際の提案前にヒアリングでの確認を推奨します。

## 1. 店舗概要（取得情報）
- 店名: ${s.name}
- 業種: ${ctx.label}
- エリア: ${area}
- 住所: ${s.address ?? "（不明・要確認）"}
- 評価: ${ratingLine}
- 掲載写真数: ${s.photo_count ?? 0}枚
- ホームページ: ${s.has_website ? "あり" : "なし"}
- Instagram: ${s.instagram_url ? "あり" : "未確認"} / Facebook: ${s.facebook_url ? "あり" : "未確認"}
- 想定顧客層: ${audience}

## 2. 店舗の強み
${opportunities.map((o) => `- ${o}`).join("\n")}

## 3. 現状の機会損失
${problems.map((p) => `- ${p}`).join("\n")}

## 4. ホームページを持つメリット
- 店名以外（「${area} ${ctx.label}」等）の検索からの新規流入を獲得できる
- 24時間予約・問い合わせを受けられ、電話対応の負荷を下げられる
- Googleマップの高評価を裏付ける情報発信で、来店の意思決定を後押しできる

## 5. 予約導線の改善ポイント
- ${ctx.bookingPoint}
- スマホ最優先（モバイルファースト）の導線設計
- 口コミ要約: ${reviewSummary}

## 6. 外国人向け対応の必要性
- ${ctx.foreignerNote}
- 沖縄エリアは訪日客比率が高く、多言語ページの費用対効果が高い（仮説：実需はエリア特性で要確認）

## 7. 推奨ページ構成
${suggested_sections.map((sec, i) => `${i + 1}. ${sec}`).join("\n")}

## 8. 簡易営業メッセージ
${sales_message}

## 9. オーナー向け5分説明用 要約
${summary}

---
*この提案書は人間による確認・編集を前提とした下書きです。*
`;
}
