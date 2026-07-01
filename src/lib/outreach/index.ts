/**
 * アウトリーチ文面生成（純関数）。
 * ④ 営業メール / ⑤ Instagram DM / ⑥ 電話トーク を、店舗情報から生成する。
 *
 * 方針:
 *  - 実在情報のみ断定し、不明点は「（仮説）」を保持（捏造防止）。
 *  - チャネルごとにトーン/長さ/構成を変える。
 *  - 業種・エリア・HP有無・SNS有無・優先度の営業切り口を反映。
 *  - LLM不要でここだけで完結（outreach/llm.ts で任意の磨き込み）。
 */
import type { Store, StoreCategory } from "@/lib/types";

export type OutreachChannel = "email" | "instagram_dm" | "phone_script";

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

/** チャネル別の主眼となる価値提案（業種差分の土台）。 */
const CATEGORY_HOOK: Record<StoreCategory, string> = {
  restaurant: "メニューの魅力とネット予約導線",
  cafe: "世界観の発信とSNS連携による来店動機づくり",
  izakaya: "コース・宴会予約とクーポン導線",
  beauty: "メニュー・料金の明確化とネット予約導線",
  clinic: "診療内容・アクセスの信頼訴求とWeb予約導線",
  hotel: "多言語対応と公式サイトからの直予約",
  retail: "商品紹介とオンライン問い合わせ導線",
  other: "強みの言語化とオンライン問い合わせ導線",
};

export interface OutreachInput {
  store: Pick<
    Store,
    | "name"
    | "category"
    | "area"
    | "rating"
    | "review_count"
    | "has_website"
    | "instagram_url"
    | "facebook_url"
  >;
  /** 優先度判定の営業切り口（あれば反映） */
  sales_angle?: string | null;
  /** 提案書の要約（あれば反映） */
  proposal_summary?: string | null;
}

function ctx(input: OutreachInput) {
  const category = (input.store.category as StoreCategory) ?? "other";
  return {
    category,
    label: CATEGORY_LABEL[category] ?? "店舗",
    hook: CATEGORY_HOOK[category] ?? CATEGORY_HOOK.other,
    area: input.store.area ?? "沖縄",
    name: input.store.name,
    hasWebsite: input.store.has_website,
    hasInstagram: !!input.store.instagram_url,
    rating: input.store.rating,
    reviews: input.store.review_count,
  };
}

/** 実績に触れる一文（データがある時だけ断定、無ければ空）。 */
function evidenceLine(rating: number | null, reviews: number): string {
  if (rating != null && reviews >= 10) {
    return `Googleマップで評価${rating}・口コミ${reviews}件と、多くのお客様に支持されている点`;
  }
  if (reviews >= 10) return `口コミ${reviews}件と来店実績が積み上がっている点`;
  return "地域で丁寧に営業されている点";
}

// ------------------------------------------------------------
// ④ 営業メール
// ------------------------------------------------------------
function buildEmail(input: OutreachInput): string {
  const c = ctx(input);
  const evidence = evidenceLine(c.rating, c.reviews);
  const problem = c.hasWebsite
    ? "現在のWebサイトはスマホでのご予約導線に改善余地があるように見受けられました（仮説）。"
    : "公式ホームページが見当たらず、検索やご予約の機会を一部逃されている可能性があります（仮説）。";

  return `件名: 【${c.area}の${c.label}向け】${c.name}様の集客を伸ばすご提案

${c.name} ご担当者様

突然のご連絡失礼いたします。${c.area}エリアの店舗様の集客支援を行っている「AI集客支援」と申します。

${c.name}様を拝見し、${evidence}に魅力を感じ、ご連絡いたしました。
一方で、${problem}

私たちは${c.label}に特化し、${c.hook}を中心に、
Googleマップの評価を「来店・予約」につなげるお手伝いをしております。

ご参考として、${c.name}様専用の“仮のホームページ（デモ）”を無料でご用意できます。
実際の画面をご覧いただき、ご興味があれば5分ほどご説明のお時間をいただけないでしょうか。

ご検討のほど、よろしくお願いいたします。

──────────
AI集客支援
${c.area}エリア担当
──────────

※本メールは公開情報をもとにお送りしています。ご不要の場合はその旨ご返信ください。`;
}

// ------------------------------------------------------------
// ⑤ Instagram DM
// ------------------------------------------------------------
function buildInstagramDm(input: OutreachInput): string {
  const c = ctx(input);
  const opener = c.hasInstagram
    ? `はじめまして！${c.name}様のInstagram拝見しました📸 投稿の雰囲気がとても素敵ですね。`
    : `はじめまして！${c.area}の${c.label}を応援している者です😊`;
  const value = c.hasWebsite
    ? `Web予約の導線を少し整えるだけで、今の集客がもっと伸ばせそうだと感じました。`
    : `ホームページがあると「${c.area} ${c.label}」の検索からの新規のお客様や、24時間予約が取りやすくなります。`;

  return `${opener}

${c.area}の${c.label}さん向けに、${c.hook}をお手伝いしています。
${value}

ご負担なしで、${c.name}様専用の“仮サイト”をお作りしてお見せできます。
もしよければ一度ご覧いただけませんか？☺️
（不要でしたらスルーで大丈夫です🙏）`;
}

// ------------------------------------------------------------
// ⑥ 電話トーク
// ------------------------------------------------------------
function buildPhoneScript(input: OutreachInput): string {
  const c = ctx(input);
  const angle = input.sales_angle?.trim() || `${c.hook}のご提案`;

  return `【電話トークスクリプト｜${c.name}様】

■ 名乗り
「お世話になっております。${c.area}の店舗様の集客支援を行っております、AI集客支援の〇〇と申します。オーナー様（ご担当者様）はいらっしゃいますか？」

■ 用件（15秒で）
「${c.area}の${c.label}さんを対象に、Googleマップの評価を予約・来店につなげるお手伝いをしております。${c.name}様の情報を拝見してご連絡しました。」

■ フック（相手の関心を引く）
「${c.hasWebsite ? "今のサイトの予約導線を少し見直すだけで" : "ホームページを持つことで"}、${c.area}での新規のお客様を取りこぼしにくくなります。」

■ 価値提案
「${angle}を軸に、まずは${c.name}様専用の“仮のサイト”を無料でお作りしてお見せしています。」

■ クロージング（アポ取り）
「5分ほど画面を見ていただくお時間をいただけないでしょうか。今週ですと〇日と〇日、どちらがご都合よろしいですか？」

■ 想定される反応と切り返し
・「間に合っている」→「多くの店舗様がそうおっしゃいます。無料のデモだけでも判断材料になりますので、見るだけ見ていただけませんか？」
・「忙しい」→「お手間は取らせません。デモのURLをお送りし、空いたときにご覧いただく形でも大丈夫です。」
・「料金は？」→「まずはデモを無料でご用意し、内容にご納得いただけた場合のみ具体的なプランをご案内します。」

※${c.rating != null ? `評価${c.rating}・口コミ${c.reviews}件（会話の裏付けに活用）` : "口コミ等の実績は会話前に再確認"}`;
}

/** チャネルに応じた文面を生成する（純関数）。 */
export function buildOutreach(channel: OutreachChannel, input: OutreachInput): string {
  switch (channel) {
    case "email":
      return buildEmail(input);
    case "instagram_dm":
      return buildInstagramDm(input);
    case "phone_script":
      return buildPhoneScript(input);
  }
}

export const OUTREACH_LABEL: Record<OutreachChannel, string> = {
  email: "営業メール",
  instagram_dm: "Instagram DM",
  phone_script: "電話トーク",
};
