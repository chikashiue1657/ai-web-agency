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
  ContactMethod,
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
import { buildHeroTitle, buildHeroSubtitle } from "@/lib/engine/hero-copy";
import { buildCtaWithRealLinks, buildContactMethodsWithRealLinks } from "@/lib/engine/real-data-links";

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
  const strengths = [brief.offer, brief.salesAngle].filter(Boolean);
  if (brief.realData?.googleRating && brief.realData.googleReviewCount) {
    strengths.push(`Google評価 ${brief.realData.googleRating.toFixed(1)}（${brief.realData.googleReviewCount}件）`);
  }
  if (brief.realData?.address) strengths.push(`${brief.area}にある実店舗`);
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
  const items = [brief.offer, brief.salesAngle, brief.siteConcept, `${brief.area}の店舗`].filter(Boolean);
  if (brief.realData?.googleRating && brief.realData.googleReviewCount) {
    items.push(`Google評価 ${brief.realData.googleRating.toFixed(1)}（${brief.realData.googleReviewCount}件）`);
  }
  if (brief.realData?.address) items.push(`${brief.area}にある実店舗`);
  if (brief.realData?.openingHours?.[0]) {
    items.push(`営業時間：${brief.realData.openingHours[0]}`);
  }
  return [...new Set(items)].slice(0, 5);
}

export function buildConcept(brief: StoreBrief, strategy: StrategyAnalysis): string {
  const base = brief.siteConcept?.trim();
  const concept = base
    ? base
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
  const address = brief.realData?.address ? ` ${brief.realData.address}。` : "";
  const metaDescription = `${brief.area}の${brief.industry}、${brief.storeName}。${brief.offer}。${address}営業時間・アクセス・店舗情報をご案内します。`;
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
      `${brief.offer}。詳しいメニューや当日の提供内容は、店舗へ直接お問い合わせください。`,
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
      brief.realData?.address
        ? `${brief.realData.address}。営業時間と最新の営業状況をご確認のうえお越しください。`
        : `${brief.area}エリアの店舗です。詳しい道順と最新の営業状況は店舗へご確認ください。`,
      BODY_MAX
    ),
    mapQuery: `${brief.storeName} ${brief.area}`,
  };
}

/**
 * 連絡手段・CTAのラベルとリンク先は、実際にbrief.realDataが存在する連絡手段
 * （電話番号/Instagram URL等）だけを対象にする必要があるため、その判定は
 * `engine/real-data-links.ts` に一本化している（ここでは委譲するだけ）。
 * 実データが無いのに「電話で予約する」「LINEで予約する」等と表示すると、
 * クリックしても何も起きない・存在しない連絡手段を約束するボタンになる
 * （本番監査で実際に発見された不具合のため、業種テンプレート側では
 * 一切リンク先を決め打ちしない）。
 */
export function buildContactMethods(brief: StoreBrief): ContactMethod[] {
  return buildContactMethodsWithRealLinks(brief);
}

export function buildCta(brief: StoreBrief): WebsiteCta {
  const headline = truncateJa(brief.offer, HERO_TITLE_MAX);
  const body = truncateJa(
    brief.realData?.phone
      ? "営業時間・アクセスをご確認のうえ、ご予約やお問い合わせはお電話ください。"
      : "営業時間・アクセスをご確認のうえ、最新情報は店舗の公式窓口でご確認ください。",
    BODY_MAX
  );
  return buildCtaWithRealLinks(headline, body, brief);
}

export function buildFaq(brief: StoreBrief, strategy: StrategyAnalysis): FaqItem[] {
  return [
    {
      question: `${brief.industry}を利用するのが初めてですが大丈夫ですか？`,
      answer: truncateJa("営業時間・提供内容は変更になる場合があります。ご来店前に店舗へ直接ご確認ください。", BODY_MAX),
    },
    {
      question: `${brief.mainProblem.replace(/。$/, "")}という悩みも相談できますか？`,
      answer: truncateJa("提供内容の詳細は、店舗へ直接お問い合わせください。", BODY_MAX),
    },
    {
      question: `${brief.area}エリア以外からでも利用できますか？`,
      answer: truncateJa("所在地とアクセスをご確認のうえお越しください。最新の営業状況は店舗へ直接ご確認ください。", BODY_MAX),
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
