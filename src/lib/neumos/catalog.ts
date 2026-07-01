/**
 * 生成コンテンツ種別のカタログ（単一定義）。
 * - UI表示・有効化フラグ・説明を一元管理し、種別追加を1箇所で完結させる。
 * - enabled=false は「将来対応（同じBriefから生成予定）」を意味する。
 */
import type { GenerationType } from "@/lib/types";

export interface GenerationTypeMeta {
  type: GenerationType;
  label: string;
  description: string;
  /** 現在生成可能か（まずは website のみ true） */
  enabled: boolean;
}

export const GENERATION_TYPES: GenerationTypeMeta[] = [
  {
    type: "website",
    label: "ホームページ",
    description: "店舗の公式サイト一式（TOP/紹介/メニュー/アクセス/FAQ/問い合わせ）",
    enabled: true,
  },
  {
    type: "landing_page",
    label: "ランディングページ",
    description: "キャンペーン/予約特化の1枚ページ（CV最適化）",
    enabled: false,
  },
  {
    type: "blog_post",
    label: "ブログ記事",
    description: "集客用の記事コンテンツ（SEO/来店動機）",
    enabled: false,
  },
  {
    type: "instagram_post",
    label: "Instagram投稿",
    description: "投稿キャプション・ハッシュタグ案",
    enabled: false,
  },
  {
    type: "google_business_improvement",
    label: "Googleビジネスプロフィール改善案",
    description: "説明文・カテゴリ・写真・投稿の改善提案",
    enabled: false,
  },
  {
    type: "faq",
    label: "FAQ",
    description: "よくある質問の生成・拡充",
    enabled: false,
  },
  {
    type: "seo_content",
    label: "SEOコンテンツ",
    description: "検索流入向けのページ/文章（キーワード設計込み）",
    enabled: false,
  },
  {
    type: "copywriting",
    label: "キャッチコピー",
    description: "店舗の訴求コピー案（複数バリエーション）",
    enabled: false,
  },
];

export const GENERATION_TYPE_LABEL: Record<GenerationType, string> = GENERATION_TYPES.reduce(
  (acc, m) => {
    acc[m.type] = m.label;
    return acc;
  },
  {} as Record<GenerationType, string>
);

export function isGenerationTypeEnabled(type: GenerationType): boolean {
  return GENERATION_TYPES.find((m) => m.type === type)?.enabled ?? false;
}
