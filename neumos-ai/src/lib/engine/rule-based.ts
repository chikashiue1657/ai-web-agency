/**
 * ルールベースのマーケティング思考エンジン（LLM無しでも完全動作する既定経路）。
 *
 * Neumos AIは「HTMLを組み立てるだけのAI」ではないという方針を、LLM不在時にも
 * 保つため、テンプレート出力の前に必ず
 *   強み分析 → 集客課題整理 → ターゲット定義 → 差別化 → コンセプト → ページ構成 → SEO
 * の順で戦略を組み立ててから文章化する。LLMが使える場合はこの戦略を下敷きに
 * `engine/website.ts` が文章の質を高める（`llm/client.ts`）。
 */
import type {
  AccessInfo,
  FaqItem,
  GalleryItem,
  GeneratedWebsiteContents,
  SectionKind,
  StoreBrief,
  StrategyAnalysis,
  WebsiteCta,
  WebsiteSection,
} from "@/lib/types";
import { BODY_MAX, HERO_TITLE_MAX, sanitizeBrief, truncateJa } from "@/lib/engine/copy-limits";
import { classifyIndustry } from "@/lib/engine/industry";
import { buildHeroTitle, buildHeroSubtitle } from "@/lib/engine/hero-copy";

const DEFAULT_PAGES = ["トップ", "お店の強み", "メニュー・サービス", "選ばれる理由", "アクセス", "よくある質問", "お問い合わせ"];

/** ページ名から Website Renderer が描画するコンポーネント種別を判定する。 */
export function classifySectionKind(page: string): SectionKind {
  if (/強み|特徴|about|こだわり|会社概要|店舗紹介/i.test(page)) return "about";
  if (/メニュー|サービス|料金|プラン|コース/i.test(page)) return "service";
  if (/選ばれる理由|差別化|feature|特長/i.test(page)) return "feature";
  return "other";
}

const REQUIRED_KIND_DEFAULT_PAGE: Record<Extract<SectionKind, "about" | "service" | "feature">, string> = {
  about: "お店の強み",
  service: "メニュー・サービス",
  feature: "選ばれる理由",
};

/** Website Renderer は About/Service/Feature を必ず描画するため、欠けていれば補う。 */
function ensureRequiredKinds(pages: string[]): string[] {
  const result = [...pages];
  for (const kind of ["about", "service", "feature"] as const) {
    const hasKind = result.some((p) => classifySectionKind(p) === kind);
    if (!hasKind) result.push(REQUIRED_KIND_DEFAULT_PAGE[kind]);
  }
  return result;
}

export function analyzeStrengths(brief: StoreBrief): string[] {
  const strengths = [
    `${brief.offer}という他にない提案ができる`,
    `${brief.salesAngle}を軸にした接客・サービス力`,
  ];
  if (brief.tone) strengths.push(`「${brief.tone}」という一貫した世界観を伝えられる`);
  return strengths;
}

export function analyzeChallenges(brief: StoreBrief): string[] {
  return [
    brief.mainProblem,
    `${brief.area}エリアでの認知不足により${brief.targetCustomer}に情報が届いていない`,
    `Webサイトが無い、または魅力が伝わる構成になっていない`,
  ];
}

export function defineTargetPersona(brief: StoreBrief): string {
  return `${brief.area}エリアで${brief.industry}を探している${brief.targetCustomer}。${brief.mainProblem}という課題を抱えており、${brief.offer}に価値を感じやすい層。`;
}

/**
 * Feature（選ばれる理由）用の差別化ポイント。
 * 以前はAboutの`strengths`をそのまま再掲していたため、About/Featureの内容が
 * 重複していた。ここではbriefの別の側面（提案内容/実力/世界観/立地/顧客理解/
 * サイトの目的）から独自に6項目を合成し、最低4件（可能なら6件）を返す。
 */
export function defineDifferentiators(brief: StoreBrief): string[] {
  const angleHeadline = brief.salesAngle.split(/[。／/]/)[0]?.trim() || brief.salesAngle;
  const offerHeadline = brief.offer.split(/[。／/]/)[0]?.trim() || brief.offer;
  const items = [
    `${offerHeadline}という他にはない提案`,
    `${angleHeadline}に裏付けられた確かな実力`,
    `${brief.area}エリアで通いやすい立地`,
    `${brief.targetCustomer}に寄り添った接客・ご案内`,
  ];
  if (brief.tone) items.push(`「${brief.tone}」という一貫した世界観`);
  items.push(`${brief.websiteGoal}につながる導線設計`);
  return items;
}

export function buildConcept(brief: StoreBrief, strategy: StrategyAnalysis): string {
  const base = brief.siteConcept?.trim();
  const angleHeadline = brief.salesAngle.split(/[。／/]/)[0]?.trim() || brief.salesAngle;
  const concept = base
    ? `${base}（${strategy.targetPersona.split("。")[0]}に向けて、${angleHeadline}を前面に打ち出す）`
    : `${brief.storeName}が${brief.targetCustomer}に${brief.offer}を届ける、${brief.tone}なサイト`;
  return truncateJa(concept, BODY_MAX);
}

export function buildPageStructure(brief: StoreBrief): string[] {
  const pages = brief.recommendedPages.filter((p) => p.trim().length > 0);
  let merged = pages;
  if (pages.length < 3) {
    merged = [...pages];
    for (const p of DEFAULT_PAGES) {
      if (!merged.includes(p)) merged.push(p);
    }
  }
  return ensureRequiredKinds(merged);
}

export function buildSeo(brief: StoreBrief): { seoTitle: string; metaDescription: string } {
  const keywords = brief.seoKeywords.slice(0, 3).join("・");
  const seoTitle = keywords
    ? `${brief.storeName}｜${brief.area}の${brief.industry}｜${keywords}`
    : `${brief.storeName}｜${brief.area}の${brief.industry}`;
  const metaDescription = `${brief.area}で${brief.industry}をお探しなら${brief.storeName}へ。${brief.offer}。${brief.mainProblem.replace(/。$/, "")}という悩みも解決します。`;
  return { seoTitle: seoTitle.slice(0, 60), metaDescription: metaDescription.slice(0, 120) };
}

/**
 * ヒーロー見出しは「施策の説明」ではなく「店舗オーナーが伝えたい価値」を優先する
 * （営業で契約率を上げる目的のため、SEOよりCV重視）。業種別のコピールールは
 * `engine/hero-copy.ts` に分離している。
 */
export function buildHeroCopy(brief: StoreBrief, strategy: StrategyAnalysis): { heroTitle: string; heroSubtitle: string } {
  const personaHeadline = strategy.targetPersona.split("。")[0]?.trim() || strategy.targetPersona;
  return {
    heroTitle: buildHeroTitle(brief),
    heroSubtitle: buildHeroSubtitle(brief, personaHeadline),
  };
}

/**
 * ページ構成のうち About/Service/Feature に分類されないもの（トップ/アクセス/FAQ/問い合わせ等）は
 * それぞれ専用コンポーネント（Hero/Access/Faq/Contact）が描画するため、汎用セクションからは除外する。
 */
export function buildSections(brief: StoreBrief, strategy: StrategyAnalysis, pages: string[]): WebsiteSection[] {
  return pages
    .map((page, i) => ({ id: `section-${i + 1}`, kind: classifySectionKind(page), heading: page, body: "" }))
    .filter((s) => s.kind !== "other")
    .map((s) => ({ ...s, body: sectionBody(s.kind, brief, strategy) }));
}

function sectionBody(kind: SectionKind, brief: StoreBrief, strategy: StrategyAnalysis): string {
  if (kind === "about") {
    return strategy.strengths.map((s) => `・${truncateJa(s, BODY_MAX)}`).join("\n");
  }
  if (kind === "service") {
    return truncateJa(
      `${brief.offer}を中心に、${brief.targetCustomer}のニーズに合わせたメニュー・サービスをご用意しています。`,
      BODY_MAX
    );
  }
  if (kind === "feature") {
    return strategy.differentiators.map((d) => `・${truncateJa(d, BODY_MAX)}`).join("\n");
  }
  const angleHeadline = brief.salesAngle.split(/[。／/]/)[0]?.trim() || brief.salesAngle;
  return truncateJa(
    `${brief.storeName}は${brief.area}で${brief.industry}を営んでおり、${angleHeadline}を大切にしています。${brief.mainProblem.replace(/。$/, "")}でお悩みの方もぜひご相談ください。`,
    BODY_MAX
  );
}

export function buildGallery(brief: StoreBrief): GalleryItem[] {
  const captions = [
    "店内の様子",
    `人気の${brief.offer}`,
    "スタッフの接客風景",
    `${brief.industry}のこだわり`,
    "外観・入口",
    `${brief.area}からのアクセス風景`,
  ];
  return captions.map((caption, i) => ({
    id: `gallery-${i + 1}`,
    caption,
    altText: `${brief.storeName}の${caption}`,
  }));
}

export function buildAccess(brief: StoreBrief): AccessInfo {
  return {
    areaLabel: brief.area,
    addressHint: truncateJa(
      `${brief.area}エリアにあり、${brief.targetCustomer}の方にもお越しいただきやすい立地です。詳しい道順はお問い合わせください。`,
      BODY_MAX
    ),
    mapQuery: `${brief.storeName} ${brief.area}`,
  };
}

/**
 * 業種によって顧客が実際に使う連絡手段は大きく異なる
 * （飲食: 電話予約/Instagram/GoogleMap、美容: LINE予約/電話、整体: 予約/電話 等）。
 * 汎用の「電話・フォーム・SNS」一律ではなく、業種ごとに優先手段を並べる。
 */
export function buildContactMethods(brief: StoreBrief): string[] {
  const category = classifyIndustry(brief.industry);
  switch (category) {
    case "cafe":
    case "izakaya":
      return ["お電話で予約", "Instagramで見る", "Google マップで見る"];
    case "hair_salon":
      return ["LINEで予約", "お電話でのお問い合わせ"];
    case "spa":
      return ["ご予約はこちら", "お電話でのお問い合わせ"];
    case "hotel":
      return ["ご予約はこちら", "お電話でのお問い合わせ", "Google マップで見る"];
    default: {
      const angleHeadline = brief.salesAngle.split(/[。／/]/)[0]?.trim() || brief.salesAngle;
      return [
        "お電話でのお問い合わせ",
        /予約/.test(brief.websiteGoal) ? "オンライン予約フォーム" : "お問い合わせフォーム",
        truncateJa(`SNSでのご相談（${angleHeadline}について）`, 40),
      ];
    }
  }
}

export function buildCta(brief: StoreBrief): WebsiteCta {
  const category = classifyIndustry(brief.industry);
  const buttonLabel = (() => {
    switch (category) {
      case "cafe":
      case "izakaya":
        return "電話で予約する";
      case "hair_salon":
        return "LINEで予約する";
      case "spa":
      case "hotel":
        return "今すぐ予約する";
      default:
        return /予約/.test(brief.websiteGoal) ? "今すぐ予約する" : "お問い合わせする";
    }
  })();

  return {
    headline: truncateJa(brief.offer, HERO_TITLE_MAX),
    body: truncateJa(`${brief.websiteGoal}をお考えの方は、今すぐお気軽にご連絡ください。`, BODY_MAX),
    buttonLabel,
  };
}

export function buildFaq(brief: StoreBrief, strategy: StrategyAnalysis): FaqItem[] {
  return [
    {
      question: `${brief.industry}を利用するのが初めてですが大丈夫ですか？`,
      answer: truncateJa(`はい、${brief.targetCustomer}のお客様にもわかりやすくご案内しますのでご安心ください。`, BODY_MAX),
    },
    {
      question: `${brief.mainProblem.replace(/。$/, "")}という悩みも相談できますか？`,
      answer: truncateJa(
        `もちろんです。${strategy.differentiators[0] ?? brief.salesAngle.split(/[。／/]/)[0]}を軸に、お客様一人ひとりに合わせてご提案します。`,
        BODY_MAX
      ),
    },
    {
      question: `${brief.area}エリア以外からでも利用できますか？`,
      answer: truncateJa(
        `はい、${brief.area}エリア外のお客様や観光客の方もご利用いただけます。お気軽にお問い合わせください。`,
        BODY_MAX
      ),
    },
  ];
}

export function buildInstagramCaption(brief: StoreBrief): string {
  const tags = brief.seoKeywords.slice(0, 5).map((k) => `#${k.replace(/\s+/g, "")}`).join(" ");
  return `${brief.storeName}｜${brief.area}\n${brief.offer} ✨\n${brief.salesAngle}な${brief.industry}、ぜひ体験してください。\n${tags} #${brief.area} #${brief.industry}`.trim();
}

export function buildGoogleBusinessImprovement(brief: StoreBrief, strategy: StrategyAnalysis): string[] {
  return [
    `ビジネス説明文に「${brief.salesAngle}」「${brief.offer}」を明記し検索意図に合わせる`,
    `${strategy.challenges[0]}に対応する投稿・写真を定期的に追加する`,
    `${brief.seoKeywords.slice(0, 3).join("・") || brief.industry}に関連するQ&Aを追加する`,
    `${brief.targetCustomer}の来店シーンが伝わる写真を追加する`,
  ];
}

export function analyzeStrategy(brief: StoreBrief): StrategyAnalysis {
  return {
    strengths: analyzeStrengths(brief),
    challenges: analyzeChallenges(brief),
    targetPersona: defineTargetPersona(brief),
    differentiators: defineDifferentiators(brief),
  };
}

export function generateWebsiteRuleBased(rawBrief: StoreBrief): GeneratedWebsiteContents {
  // brief中の自由記述（targetCustomer等）に社内向けの括弧書きメモが含まれることがあり、
  // そのまま連結すると公開ページの見出し・本文に漏れ出す（実例:
  // 「（仮説：要ヒアリングで確定）」がヒーローの補足コピーにそのまま表示されていた）。
  // 以降の全ての組み立て処理は、このsanitize済みbriefだけを参照する。
  const brief = sanitizeBrief(rawBrief);
  const strategy = analyzeStrategy(brief);
  const pages = buildPageStructure(brief);
  const { seoTitle, metaDescription } = buildSeo(brief);
  const { heroTitle, heroSubtitle } = buildHeroCopy(brief, strategy);

  return {
    concept: buildConcept(brief, strategy),
    heroTitle,
    heroSubtitle,
    sections: buildSections(brief, strategy, pages),
    gallery: buildGallery(brief),
    access: buildAccess(brief),
    contactMethods: buildContactMethods(brief),
    cta: buildCta(brief),
    seoTitle,
    metaDescription,
    faq: buildFaq(brief, strategy),
    instagramCaption: buildInstagramCaption(brief),
    googleBusinessImprovement: buildGoogleBusinessImprovement(brief, strategy),
    strategy,
  };
}
