/**
 * SEO metadata 生成（純関数）。
 * - title/description を業種・エリア・店名から組み立てる。
 * - 文字数を実用域にトリム（title<=60, description<=120目安）。
 */
import type { StoreCategory } from "@/lib/types";

const CATEGORY_JA: Record<StoreCategory, string> = {
  restaurant: "飲食店",
  cafe: "カフェ",
  izakaya: "居酒屋",
  beauty: "美容サロン",
  clinic: "クリニック",
  hotel: "宿泊施設",
  retail: "ショップ",
  other: "店舗",
};

function trim(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

export interface SeoInput {
  name: string;
  category: StoreCategory | string | null;
  area: string | null;
  /** 口コミ等から抽出した訴求フレーズ（任意） */
  appeal?: string | null;
}

export function buildSeo(input: SeoInput): { title: string; description: string } {
  const cat = CATEGORY_JA[(input.category as StoreCategory) ?? "other"] ?? "店舗";
  const area = input.area ?? "沖縄";
  const title = trim(`${input.name}｜${area}の${cat}`, 60);
  const appeal = input.appeal?.trim();
  const description = trim(
    appeal
      ? `${area}の${cat}「${input.name}」。${appeal} アクセス・営業時間・メニュー・ご予約はこちら。`
      : `${area}の${cat}「${input.name}」の公式情報。アクセス・営業時間・メニュー・ご予約はこちらからご確認いただけます。`,
    120
  );
  return { title, description };
}

/** ページ別のSEO（サブページはサフィックスを付ける）。 */
export function buildPageSeo(
  base: { title: string; description: string },
  pageLabel: string
): { title: string; description: string } {
  if (!pageLabel) return base;
  return {
    title: trim(`${pageLabel}｜${base.title}`, 60),
    description: base.description,
  };
}
