import type { GenerationType } from "@/lib/types";

/** 生成種別のUI表示ラベル（単一定義）。種別追加はここに1行足すだけでよい。 */
export const GENERATION_TYPE_LABELS: Record<GenerationType, string> = {
  website: "ホームページ",
  landing_page: "ランディングページ",
  instagram_post: "Instagram投稿",
  google_business_improvement: "Googleビジネスプロフィール改善案",
  blog_post: "ブログ記事",
  faq: "FAQ",
  seo_content: "SEOコンテンツ",
  copywriting: "キャッチコピー",
};
