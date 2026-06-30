/**
 * 仮デモサイト生成（純関数）。
 *
 * 役割:
 *  - 正規化済み店舗情報から営業用の仮サイト構造(SiteDocument)を生成。
 *  - 業種別テーマ分岐、口コミ由来の訴求反映、SEO生成、写真不足フォールバック。
 *  - 実在しない情報は作らず、補完部分は isHypothesis フラグで明示。
 *  - 生成物はJSON（generated_json）でDB保存し、UIはこれを描画（CMS化容易）。
 */
import type { Store, StoreCategory, SiteDocument, SitePage } from "@/lib/types";
import { pickTheme, type ThemeType } from "./themes";
import { buildSeo, buildPageSeo } from "./seo";
import { generateSlug } from "./slug";

const TOURIST_HEAVY: StoreCategory[] = ["restaurant", "cafe", "izakaya", "hotel"];

/** 口コミ要約から短い訴求フレーズを抽出（簡易・純関数）。 */
export function extractAppeal(reviewSummary?: string | null): string | null {
  if (!reviewSummary) return null;
  const s = reviewSummary.trim();
  if (!s) return null;
  // 最初の文を訴求に流用（句点/改行で区切る）。長すぎる場合はトリム。
  const first = s.split(/[。．\n]/)[0]?.trim();
  if (!first) return null;
  return first.length > 40 ? first.slice(0, 39) + "…" : first;
}

export interface BuildSiteInput {
  store: Pick<
    Store,
    | "name"
    | "category"
    | "area"
    | "address"
    | "phone"
    | "opening_hours"
    | "rating"
    | "review_count"
    | "photo_count"
    | "website_url"
    | "instagram_url"
    | "facebook_url"
  >;
  /** 口コミ要約（任意・訴求/レビューセクションに反映） */
  review_summary?: string | null;
  /** メニュー/サービス例（任意・無ければ仮説プレースホルダ） */
  menu_items?: Array<{ title: string; description?: string; meta?: string }>;
  /** テーマ明示指定（任意） */
  theme?: ThemeType;
  language?: string;
  /** slug衝突回避用の既存集合（任意） */
  existingSlugs?: Set<string>;
}

export interface BuildSiteResult {
  slug: string;
  document: SiteDocument;
}

/** 仮デモサイトを生成する。 */
export function buildSite(input: BuildSiteInput): BuildSiteResult {
  const { store } = input;
  const category = (store.category as StoreCategory) ?? "other";
  const tourist = TOURIST_HEAVY.includes(category);
  const theme = pickTheme(category, { explicit: input.theme, tourist });
  const language = input.language ?? "ja";
  const notes: string[] = [];

  const appeal = extractAppeal(input.review_summary);
  if (appeal) notes.push("口コミ要約から訴求フレーズを抽出");
  else notes.push("口コミ要約なし：訴求は一般表現＋仮説で補完");

  // 写真不足フォールバック判定
  const usedPhotoFallback = (store.photo_count ?? 0) < 3;
  if (usedPhotoFallback)
    notes.push("写真が少ないため、テーマカラーのプレースホルダ前提で構成");

  const baseSeo = buildSeo({
    name: store.name,
    category,
    area: store.area,
    appeal,
  });

  const pages = buildPages({ store, category, appeal, baseSeo, input, tourist });

  const slug = generateSlug(
    store.name,
    store.address ?? store.phone ?? store.name,
    input.existingSlugs
  );

  const document: SiteDocument = {
    storeName: store.name,
    themeType: theme.type,
    language,
    brandColor: theme.brandColor,
    pages,
    usedPhotoFallback,
    generationNotes: notes,
  };

  return { slug, document };
}

function buildPages(args: {
  store: BuildSiteInput["store"];
  category: StoreCategory;
  appeal: string | null;
  baseSeo: { title: string; description: string };
  input: BuildSiteInput;
  tourist: boolean;
}): SitePage[] {
  const { store, category, appeal, baseSeo, input, tourist } = args;
  const area = store.area ?? "沖縄";
  const hypo = true; // 仮説フラグ

  const menuLabel =
    category === "beauty" || category === "clinic" ? "メニュー・料金" : "メニュー";
  const menuPageSlug = category === "clinic" ? "services" : "menu";

  // メニュー項目（実データが無ければ仮説プレースホルダ）
  const menuItems =
    input.menu_items && input.menu_items.length > 0
      ? input.menu_items
      : [
          {
            title: "（仮）おすすめメニュー",
            description: "実際の提供内容はヒアリングで差し替えます（仮説）。",
            meta: "要確認",
          },
        ];

  const openingHoursText =
    store.opening_hours?.weekday_text?.join(" / ") ??
    store.opening_hours?.raw?.join(" / ") ??
    "（営業時間は要確認）";

  // --- TOP ---
  const top: SitePage = {
    slug: "",
    title: "TOP",
    seo: baseSeo,
    sections: [
      {
        type: "hero",
        heading: `${area}の${store.name}`,
        body: appeal
          ? `${appeal}。${store.name}へようこそ。`
          : `${store.name}の公式情報ページ（仮）。`,
        isHypothesis: !appeal,
      },
      ...(store.rating != null
        ? [
            {
              type: "reviews" as const,
              heading: "お客様からの評価",
              body: `Googleマップ評価 ${store.rating}（口コミ${store.review_count ?? 0}件）`,
            },
          ]
        : []),
      {
        type: "contact" as const,
        heading: "ご予約・お問い合わせ",
        body: store.phone ? `お電話: ${store.phone}` : "お問い合わせ先は準備中です（要確認）。",
        isHypothesis: !store.phone,
      },
    ],
  };

  // --- 店舗紹介 ---
  const about: SitePage = {
    slug: "about",
    title: "店舗紹介",
    seo: buildPageSeo(baseSeo, "店舗紹介"),
    sections: [
      {
        type: "about",
        heading: `${store.name}について`,
        body: appeal
          ? `${appeal}。${area}で営業しています。`
          : `${area}で営業する${store.name}のご紹介（詳細はヒアリングで確定／仮説）。`,
        isHypothesis: !appeal,
      },
    ],
  };

  // --- メニュー/サービス ---
  const menu: SitePage = {
    slug: menuPageSlug,
    title: menuLabel,
    seo: buildPageSeo(baseSeo, menuLabel),
    sections: [
      {
        type: "menu",
        heading: menuLabel,
        items: menuItems,
        isHypothesis: !(input.menu_items && input.menu_items.length > 0),
      },
    ],
  };

  // --- アクセス ---
  const access: SitePage = {
    slug: "access",
    title: "アクセス",
    seo: buildPageSeo(baseSeo, "アクセス"),
    sections: [
      {
        type: "access",
        heading: "アクセス・営業時間",
        body: [
          store.address ? `住所: ${store.address}` : "住所: （要確認）",
          `営業時間: ${openingHoursText}`,
          store.phone ? `電話: ${store.phone}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        isHypothesis: !store.address,
      },
    ],
  };

  // --- FAQ ---
  const faq: SitePage = {
    slug: "faq",
    title: "FAQ",
    seo: buildPageSeo(baseSeo, "よくある質問"),
    sections: [
      {
        type: "faq",
        heading: "よくあるご質問",
        faqs: buildFaqs(category, tourist),
        isHypothesis: hypo,
      },
    ],
  };

  // --- 問い合わせ導線 ---
  const contact: SitePage = {
    slug: "contact",
    title: "お問い合わせ",
    seo: buildPageSeo(baseSeo, "お問い合わせ"),
    sections: [
      {
        type: "contact",
        heading: "ご予約・お問い合わせ",
        body: [
          store.phone ? `お電話: ${store.phone}` : "お電話: （要確認）",
          store.instagram_url ? `Instagram: ${store.instagram_url}` : null,
          store.facebook_url ? `Facebook: ${store.facebook_url}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        isHypothesis: !store.phone,
      },
    ],
  };

  return [top, about, menu, access, faq, contact];
}

/** 業種別の汎用FAQ（仮説ベース・営業デモ用）。 */
function buildFaqs(category: StoreCategory, tourist: boolean): Array<{ q: string; a: string }> {
  const common = [
    { q: "予約はできますか？", a: "（仮）お電話またはWebからご予約いただけます。詳細は店舗にご確認ください。" },
    { q: "駐車場はありますか？", a: "（仮）近隣の駐車場情報は準備中です。要確認。" },
  ];
  const byCat: Partial<Record<StoreCategory, Array<{ q: string; a: string }>>> = {
    restaurant: [{ q: "個室はありますか？", a: "（仮）席タイプは店舗にご確認ください。" }],
    beauty: [{ q: "当日予約は可能ですか？", a: "（仮）空き状況により可能です。要確認。" }],
    clinic: [{ q: "保険診療に対応していますか？", a: "（仮）診療内容により異なります。要確認。" }],
    hotel: [{ q: "チェックイン時間は？", a: "（仮）標準的な時間帯を想定。要確認。" }],
  };
  const tourismFaq = tourist
    ? [{ q: "Do you have an English menu?", a: "(Draft) Multilingual support can be added. To be confirmed." }]
    : [];
  return [...common, ...(byCat[category] ?? []), ...tourismFaq];
}
