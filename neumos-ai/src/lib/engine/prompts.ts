import type { StoreBrief, StrategyAnalysis } from "@/lib/types";

export const WEBSITE_SYSTEM_PROMPT = `あなたは「Neumos AI」— 店舗の売上・集客を伸ばすためのマーケティング戦略家 兼 Webコピーライターです。
単にHTMLやテキストを組み立てるのではなく、必ず次の順序で思考してから文章を作成してください:
1. 店舗の強みを分析する
2. 集客課題を整理する
3. ターゲット顧客を具体的に定義する
4. サイトコンセプトを言語化する
5. 上記に基づきページ構成・SEOキーワードを踏まえた本文を作成する
出力は指定されたJSON schemaに厳密に従い、日本語の自然な文章で、誇張や事実の捏造（実在しない実績・数値等）は行わないでください。`;

export function buildWebsitePrompt(brief: StoreBrief, strategy: StrategyAnalysis): string {
  return `以下は店舗情報とAI診断済みの戦略下書きです。これを踏まえてホームページ用コンテンツを生成してください。

# 店舗情報 (StoreBrief)
${JSON.stringify(brief, null, 2)}

# 戦略下書き（ルールベースで作成済み。参考にしつつ、より説得力のある表現に磨き上げてよい）
${JSON.stringify(strategy, null, 2)}

# 出力してほしいJSON schema
{
  "concept": string,               // サイトコンセプト（1〜2文）
  "heroTitle": string,              // トップのキャッチコピー
  "heroSubtitle": string,           // キャッチコピーを補足する一文
  "sections": [{ "id": string, "kind": "about"|"service"|"feature", "heading": string, "body": string }],
    // Website Rendererが About/Service/Feature の3コンポーネントとして描画するため、
    // kind="about" / "service" / "feature" を最低1件ずつ、合計3〜6セクション含めること。
  "gallery": [{ "id": string, "caption": string, "altText": string }], // 4〜6件。実写真は無い前提で、雰囲気が伝わる短いキャプションのみ
  "access": { "areaLabel": string, "addressHint": string, "mapQuery": string }, // mapQueryは「店舗名 + エリア」等、地図検索に使える文字列
  "contactMethods": string[], // 問い合わせ手段（電話/フォーム/SNS等）2〜3件
  "cta": { "headline": string, "body": string, "buttonLabel": string },
  "seoTitle": string,               // 60文字以内目安
  "metaDescription": string,        // 120文字以内目安
  "faq": [{ "question": string, "answer": string }], // 3〜5件
  "instagramCaption": string,       // ハッシュタグ込みの投稿文
  "googleBusinessImprovement": string[], // Googleビジネスプロフィール改善案 3〜5件
  "strategy": {
    "strengths": string[],
    "challenges": string[],
    "targetPersona": string,
    "differentiators": string[]
  }
}

JSONのみを出力してください。`;
}
