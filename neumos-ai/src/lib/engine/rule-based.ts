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

export function defineDifferentiators(brief: StoreBrief, strengths: string[]): string[] {
  return [...strengths, `${brief.websiteGoal}に特化した導線設計`];
}

export function buildConcept(brief: StoreBrief, strategy: StrategyAnalysis): string {
  const base = brief.siteConcept?.trim();
  if (base) {
    return `${base}（${strategy.targetPersona.split("。")[0]}に向けて、${brief.salesAngle}を前面に打ち出す）`;
  }
  return `${brief.storeName}が${brief.targetCustomer}に${brief.offer}を届ける、${brief.tone}なサイト`;
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

export function buildHeroCopy(brief: StoreBrief, strategy: StrategyAnalysis): { heroTitle: string; heroSubtitle: string } {
  return {
    heroTitle: `${brief.storeName} — ${brief.salesAngle}`,
    heroSubtitle: `${strategy.targetPersona.split("。")[0]}へ。${brief.offer}`,
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
    return strategy.strengths.map((s) => `・${s}`).join("\n");
  }
  if (kind === "service") {
    return `${brief.offer}を中心に、${brief.targetCustomer}のニーズに合わせたメニュー・サービスをご用意しています。`;
  }
  if (kind === "feature") {
    return strategy.differentiators.map((d) => `・${d}`).join("\n");
  }
  return `${brief.storeName}は${brief.area}で${brief.industry}を営んでおり、${brief.salesAngle}を大切にしています。${brief.mainProblem.replace(/。$/, "")}でお悩みの方もぜひご相談ください。`;
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
    addressHint: `${brief.area}エリアにあり、${brief.targetCustomer}の方にもお越しいただきやすい立地です。詳しい道順はお問い合わせください。`,
    mapQuery: `${brief.storeName} ${brief.area}`,
  };
}

export function buildContactMethods(brief: StoreBrief): string[] {
  const methods = ["お電話でのお問い合わせ"];
  methods.push(/予約/.test(brief.websiteGoal) ? "オンライン予約フォーム" : "お問い合わせフォーム");
  methods.push(`SNSでのご相談（${brief.salesAngle}について）`);
  return methods;
}

export function buildCta(brief: StoreBrief): WebsiteCta {
  return {
    headline: `${brief.offer}`,
    body: `${brief.websiteGoal}をお考えの方は、今すぐお気軽にご連絡ください。`,
    buttonLabel: /予約/.test(brief.websiteGoal) ? "今すぐ予約する" : "お問い合わせする",
  };
}

export function buildFaq(brief: StoreBrief, strategy: StrategyAnalysis): FaqItem[] {
  return [
    {
      question: `${brief.industry}を利用するのが初めてですが大丈夫ですか？`,
      answer: `はい、${brief.targetCustomer}のお客様にもわかりやすくご案内しますのでご安心ください。`,
    },
    {
      question: `${brief.mainProblem.replace(/。$/, "")}という悩みも相談できますか？`,
      answer: `もちろんです。${brief.salesAngle}を軸に、お客様一人ひとりに合わせてご提案します。`,
    },
    {
      question: `${brief.area}エリア以外からでも利用できますか？`,
      answer: `${strategy.targetPersona}`,
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
  const strengths = analyzeStrengths(brief);
  return {
    strengths,
    challenges: analyzeChallenges(brief),
    targetPersona: defineTargetPersona(brief),
    differentiators: defineDifferentiators(brief, strengths),
  };
}

export function generateWebsiteRuleBased(brief: StoreBrief): GeneratedWebsiteContents {
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
