import type { StoreBrief, StrategyAnalysis } from "@/lib/types";

export const WEBSITE_SYSTEM_PROMPT = `あなたは「Neumos AI」— 店舗の売上・集客を伸ばすためのマーケティング戦略家 兼 Webコピーライターです。
単にHTMLやテキストを組み立てるのではなく、必ず次の順序で思考してから文章を作成してください:
1. 店舗の強みを分析する
2. 集客課題を整理する
3. ターゲット顧客を具体的に定義する
4. サイトコンセプトを言語化する
5. 上記に基づきページ構成・SEOキーワードを踏まえた本文を作成する

このホームページの目的は「営業先の店舗オーナーに“これ欲しい”と言われる品質」であり、
単なる情報掲載ではありません。特にヒーローの見出しはSEOやキーワード網羅より
CV（問い合わせ・来店・予約）につながる訴求を最優先してください
（「〇〇による集客支援」のような施策説明ではなく、店舗オーナーが本当に伝えたい
価値・魅力を一言で言い切る）。

以下のような、どの店舗にも当てはまる紋切り型・AIっぽい定型表現は禁止します:
「〜をご用意しています」「〜に価値を感じやすい層」「一貫した世界観」
「〜でお悩みの方もぜひご相談ください」等の量産型フレーズをそのまま使わず、
その店舗ならではの言葉選び・具体性のある表現にすること。

出力は指定されたJSON schemaに厳密に従い、日本語の自然な文章で、誇張や事実の捏造
（実在しない実績・数値・店舗情報等）は行わないでください。StoreBrief.realDataに
実データ（営業時間・電話番号・住所・Instagram・Google評価等）が含まれる場合のみ
それらを言及してよく、含まれない項目については触れないこと（無い情報を作らない）。`;

export function buildWebsitePrompt(brief: StoreBrief, strategy: StrategyAnalysis): string {
  return `以下は店舗情報とAI診断済みの戦略下書きです。これを踏まえてホームページ用コンテンツを生成してください。

# 店舗情報 (StoreBrief)
${JSON.stringify(brief, null, 2)}

# 戦略下書き（ルールベースで作成済み。参考にしつつ、より説得力のある表現に磨き上げてよい）
${JSON.stringify(strategy, null, 2)}

# 出力してほしいJSON schema
{
  "concept": string,               // サイトコンセプト（1〜2文、150文字以内目安）
  "heroTitle": string,              // トップのキャッチコピー。スマホでも2〜3行に収まる短い一文（36文字以内目安）。
    // 施策の説明ではなく、店舗オーナーが一番伝えたい価値・魅力そのものを言い切ること。
    // 業種の空気感に合わせる（例: カフェ「毎日通いたくなる〇〇」、美容室「あなた史上最高の髪へ」、
    // 整体「〜を根本改善」等）。SEOキーワードの詰め込みより訴求力（CV）を優先すること。
  "heroSubtitle": string,           // キャッチコピーを補足する一文（70文字以内目安）
  "sections": [{ "id": string, "kind": "about"|"service"|"feature", "heading": string, "body": string }],
    // Website Rendererが About/Service/Feature の3コンポーネントとして描画するため、
    // kind="about" / "service" / "feature" を最低1件ずつ、合計3〜6セクション含めること。
    // 各bodyは100〜150文字程度に収め、長文の垂れ流しにしないこと。
    // kind="feature"は最低4件、可能なら6件のセクションに分け、提案内容・実力・立地・
    // 顧客理解・世界観・サイトの目的などbriefの異なる側面からその店独自の強みを示すこと
    // （About と同じ内容の言い換えにしないこと）。
  "gallery": [{ "id": string, "caption": string, "altText": string }], // 4〜6件。実写真は無い前提で、雰囲気が伝わる短いキャプションのみ
  "access": { "areaLabel": string, "addressHint": string, "mapQuery": string }, // addressHintは150文字以内目安。mapQueryは「店舗名 + エリア」等、地図検索に使える文字列
  "contactMethods": string[], // 見出し的なラベルのみでよい（実際にどの連絡手段を載せるかは
    // brief.realDataの有無に応じてシステム側が最終決定するため、ここでは1〜2件で十分）
  "cta": { "headline": string, "body": string, "buttonLabel": string }, // headline/bodyのみ使用する。
    // buttonLabelは参考程度（実際のボタン文言・リンク先はbrief.realDataの有無に応じて
    // システム側が決定するため、「LINEで予約する」等realDataに無い連絡手段を書いても反映されない）
  "seoTitle": string,               // 60文字以内目安
  "metaDescription": string,        // 120文字以内目安
  "faq": [{ "question": string, "answer": string }], // 3〜5件。answerは質問に直接答え、150文字以内目安
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
