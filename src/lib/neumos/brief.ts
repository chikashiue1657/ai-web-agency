/**
 * サイト生成ブリーフの組み立て（純関数）。
 *
 * 役割:
 *  - 店舗・優先度・提案書を、ノイモスAI（HP自動生成AI）へ渡す1つの契約
 *    (SiteGenerationBrief) に集約する。
 *  - 実データと仮説を分離し、捏造を防ぐ（assumptions に仮説を明示）。
 *  - 生成エンジン非依存。ここが安定していれば生成側を差し替え可能。
 *
 * 拡張余地:
 *  - schemaVersion を上げる際は後方互換を保ちつつフィールドを追加する。
 */
import type {
  Store,
  Lead,
  Proposal,
  StoreCategory,
  SiteGenerationBrief,
} from "@/lib/types";
import { pickTheme } from "@/lib/site/themes";
import { buildSeo } from "@/lib/site/seo";
import { extractAppeal } from "@/lib/site";
import { extractPhotoNames } from "@/lib/places/photos";

export const BRIEF_SCHEMA_VERSION = "1.0";

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

const TOURIST_HEAVY: StoreCategory[] = ["restaurant", "cafe", "izakaya", "hotel"];

export interface BuildBriefInput {
  store: Store;
  lead?: Lead | null;
  proposal?: Proposal | null;
  /** 想定顧客層の明示指定（無ければ提案書/仮説から補完） */
  target?: string | null;
  /** 口コミ要約（あれば訴求・SEOに反映） */
  reviewSummary?: string | null;
}

/**
 * ブリーフを組み立てる。副作用なし・決定的（テスト容易）。
 */
export function buildSiteGenerationBrief(input: BuildBriefInput): SiteGenerationBrief {
  const { store, lead, proposal } = input;
  const category = (store.category as StoreCategory) ?? "other";
  const categoryLabel = CATEGORY_LABEL[category] ?? "店舗";
  const area = store.area;
  const tourist = TOURIST_HEAVY.includes(category);

  const reviewSummary = input.reviewSummary ?? null;
  const appeal = extractAppeal(reviewSummary);

  // 強み: 提案書の opportunities を優先。無ければ実データから最小限を導出。
  const strengths =
    proposal?.opportunities && proposal.opportunities.length > 0
      ? proposal.opportunities
      : deriveStrengths(store);

  // 改善点/期待効果: 提案書があれば流用。
  const improvements = proposal?.problems ?? deriveImprovements(store);
  const expectedEffects = deriveExpectedEffects(store);

  const suggestedSections = proposal?.suggested_sections ?? [];

  const theme = pickTheme(category, { tourist });
  const seo = buildSeo({ name: store.name, category, area, appeal });

  // 想定顧客層は明示指定を優先。無ければ業種/立地から仮説として補完（要ヒアリング）。
  const target =
    input.target ??
    `${area ?? "沖縄"}周辺の地域客${tourist ? "＋観光客（訪日客含む）" : ""}（仮説：要ヒアリング）`;

  // 仮説の明示（要確認事項）
  const assumptions: string[] = [];
  if (!store.address) assumptions.push("住所が未取得（地図・アクセス生成前に要確認）");
  if (!reviewSummary) assumptions.push("口コミ要約が未取得（訴求は一般表現＋仮説で補完）");
  if (!store.phone) assumptions.push("電話番号が未取得（問い合わせ導線は要確認）");
  if (store.photo_count < 3) assumptions.push("写真が少ない（フォールバック前提／撮影提案を推奨）");
  assumptions.push("想定顧客層・メニュー等の具体はヒアリングで確定する前提");

  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    store: {
      storeId: store.id,
      name: store.name,
      category,
      categoryLabel,
      area,
      address: store.address,
      phone: store.phone,
      openingHours:
        store.opening_hours?.weekday_text ?? store.opening_hours?.raw ?? null,
    },
    online: {
      hasWebsite: store.has_website,
      websiteUrl: store.website_url,
      instagramUrl: store.instagram_url,
      facebookUrl: store.facebook_url,
    },
    metrics: {
      rating: store.rating,
      reviewCount: store.review_count,
      photoCount: store.photo_count,
      photoRefs: extractPhotoNames(store.raw_payload, 12),
    },
    strengths,
    improvements,
    expectedEffects,
    target,
    salesAngle: lead?.sales_angle ?? null,
    priority:
      lead?.priority_rank && lead.score != null
        ? { rank: lead.priority_rank, score: lead.score }
        : null,
    suggestedSections,
    theme: { suggestedType: theme.type, brandColorHint: theme.brandColor },
    seo: { titleHint: seo.title, descriptionHint: seo.description },
    reviewSummary,
    assumptions,
    sourceProposalMarkdown: proposal?.generated_markdown ?? null,
  };
}

/** 提案書が無い場合の強み導出（実データのみ／仮説明記）。 */
function deriveStrengths(store: Store): string[] {
  const out: string[] = [];
  if (store.rating != null && store.rating >= 4.0)
    out.push(`Googleマップ評価${store.rating}と高評価`);
  if (store.review_count >= 50) out.push(`口コミ${store.review_count}件の来店実績`);
  if (store.instagram_url || store.facebook_url) out.push("SNS運用による発信力");
  if (out.length === 0) out.push("（仮説）地域での営業実績（要ヒアリング）");
  return out;
}

function deriveImprovements(store: Store): string[] {
  const out: string[] = [];
  if (!store.has_website) out.push("公式ホームページが無く検索・予約を取りこぼしている");
  if (store.photo_count < 5) out.push("掲載写真が少なく魅力が十分に伝わっていない");
  if (!store.instagram_url && !store.facebook_url)
    out.push("（仮説）SNS未活用でリピート導線が弱い可能性");
  if (out.length === 0) out.push("Web導線の最適化余地（要確認）");
  return out;
}

function deriveExpectedEffects(store: Store): string[] {
  return store.has_website
    ? ["（仮説）予約導線改善による問い合わせ増", "（仮説）スマホ最適化による離脱低減"]
    : ["（仮説）エリア×業種検索からの新規流入", "（仮説）24時間WEB予約による取りこぼし削減"];
}
