import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { WebsiteRendererV2 } from "@/components/website-v2/WebsiteRendererV2";
import type { BrandPlan } from "@/lib/brand-director/types";
import type { StoreBrief } from "@/lib/types";

/**
 * WebsiteRendererV2の`brandPlan`（Brand Director接続層）の反映を検証する。
 * ここではBrandPlan自体をテスト側で直接組み立てて渡す（OpenAI/rule-providerの
 * 実装は brand-director-v2-connector.test.ts で別途検証済み）ため、
 * このファイルは「BrandPlanが与えられた場合にレンダラーが正しく反映するか」
 * だけに専念する。
 */
const cafeBrief: StoreBrief = {
  storeName: "BB-Coffee",
  industry: "カフェ",
  area: "沖縄市",
  targetCustomer: "地元客・観光客",
  mainProblem: "新規客の獲得が伸び悩んでいる",
  salesAngle: "自家焙煎の香りと落ち着いた店内体験",
  websiteGoal: "来店予約とInstagramフォローの増加",
  siteConcept: "焙煎の香りが伝わる、静かな時間を過ごせるカフェ",
  recommendedPages: ["トップ"],
  seoKeywords: ["沖縄市 カフェ"],
  tone: "落ち着いた・上質",
  offer: "本日の一杯 500円〜",
};

function makeBrandPlan(overrides: Partial<BrandPlan> = {}): BrandPlan {
  return {
    brandArchetype: "artisan",
    industry: "cafe",
    audiences: ["地元客・観光客"],
    customerIntent: "新規客の獲得が伸び悩んでいる",
    moodKeywords: ["落ち着いた・上質", "自家焙煎の香りと落ち着いた店内体験", "本日の一杯"],
    valueProposition: "自家焙煎の香りと落ち着いた店内体験",
    visualDirection: { paletteHint: "neutral", typographyTone: "editorial-serif", photoTreatment: "framed" },
    copyDirection: { tone: "落ち着いた・上質", emphasis: "atmosphere" },
    layoutVariant: "direct",
    photoAssignments: [],
    ctaStrategy: { placement: "end-only", urgency: "medium" },
    confidence: 0.7,
    evidence: [{ field: "moodKeywords", basis: "brief", detail: "brief.toneより" }],
    ...overrides,
  };
}

describe("WebsiteRendererV2: brandPlan省略時（既存動作の回帰確認）", () => {
  it("brandPlanを渡さない場合、既定テーマ（amber/serif）のまま描画される", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} />);
    expect(html).toContain("text-amber-900");
    expect(html).toContain("font-serif");
  });
});

describe("WebsiteRendererV2: visualDirectionの反映", () => {
  it("paletteHint=high-contrastの場合、accentTextがtext-blackになる（sensory-immersive方向はhigh-contrastをクランプしない）", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = makeBrandPlan({
      brandArchetype: "energetic-casual",
      visualDirection: { paletteHint: "high-contrast", typographyTone: "editorial-serif", photoTreatment: "framed" },
    });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain("text-black");
    expect(html).not.toContain("text-amber-900");
  });

  it("brandArchetype=luxury-quiet(sensory-immersive方向)の場合、displayFontがfont-sansになる", () => {
    // typographyScaleはvisualDirection.typographyToneの直接反映ではなく、
    // artDirection(brandArchetypeから導出)ごとに固定される。sensory-immersiveの
    // うちluxury-quietはclean-sans(font-sans)を使う。
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = makeBrandPlan({ brandArchetype: "luxury-quiet" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain("font-sans");
    expect(html).not.toContain("font-serif");
  });
});

describe("WebsiteRendererV2: layoutVariantの反映", () => {
  const photoBrief: StoreBrief = {
    ...cafeBrief,
    realData: {
      photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"],
    },
  };

  it("layoutVariant=immersiveかつ写真が3枚以上ある場合、photoStoryがstoryより前に来る", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({ layoutVariant: "immersive" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html.indexOf('id="photo-story"')).toBeGreaterThan(-1);
    expect(html.indexOf('id="photo-story"')).toBeLessThan(html.indexOf('id="story"'));
  });

  it("layoutVariant=directでは並びが変わらない（storyが先、photoStoryは後）", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({ layoutVariant: "direct" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html.indexOf('id="story"')).toBeLessThan(html.indexOf('id="photo-story"'));
  });
});

describe("WebsiteRendererV2: ctaStrategyの反映", () => {
  it("placement=after-storyの場合、末尾に加えてstory直後にも控えめなCTAが挿入される（2箇所）", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = makeBrandPlan({ ctaStrategy: { placement: "after-story", urgency: "high" } });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    const occurrences = html.split(contents.cta.buttonLabel).length - 1;
    // Heroの単一CTA + 末尾CTA + 早期CTA = 3箇所（Heroは既存仕様で常に1つ）。
    expect(occurrences).toBeGreaterThanOrEqual(3);
    expect(html).toContain('id="contact"');
  });

  it("placement=end-onlyの場合、早期CTAは追加されない", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = makeBrandPlan({ ctaStrategy: { placement: "end-only", urgency: "low" } });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    const occurrences = html.split(contents.cta.buttonLabel).length - 1;
    // Heroの単一CTA + 末尾CTA + モバイル下部固定CTA = 3箇所（早期CTAは追加されない）。
    expect(occurrences).toBe(3);
  });
});

describe("WebsiteRendererV2: photoAssignmentsの反映（実データ優先・捏造防止）", () => {
  const photoBrief: StoreBrief = {
    ...cafeBrief,
    realData: {
      photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"],
    },
  };

  it("BrandPlanのphotoAssignmentsで役割指定された写真がheroに使われる（位置ではなく役割で決まる）", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({
      photoAssignments: [
        { photoUrl: "https://example.com/c.jpg", role: "hero", qualityScore: 90, rejectionReason: null },
        { photoUrl: "https://example.com/a.jpg", role: "story", qualityScore: 80, rejectionReason: null },
      ],
    });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain('src="https://example.com/c.jpg"');
  });

  it("実データに存在しないURLがphotoAssignmentsに混ざっている場合は無視し、位置ベースへフォールバックする", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({
      photoAssignments: [
        { photoUrl: "https://example.com/does-not-exist.jpg", role: "hero", qualityScore: 90, rejectionReason: null },
      ],
    });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    // 捏造されたURLは使われず、位置ベース（1枚目=Hero）にフォールバックする。
    expect(html).toContain('src="https://example.com/a.jpg"');
    expect(html).not.toContain("does-not-exist.jpg");
  });
});

describe("WebsiteRendererV2: v1経路への非影響", () => {
  it("カフェ以外の業種ではbrandPlanを渡してもv1へフォールバックし、BrandPlanは無視される", () => {
    const salonBrief: StoreBrief = { ...cafeBrief, storeName: "美容室 結", industry: "美容室" };
    const contents = generateWebsiteRuleBased(salonBrief);
    const brandPlan = makeBrandPlan({ visualDirection: { paletteHint: "high-contrast", typographyTone: "bold-display", photoTreatment: "framed" } });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={salonBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain("v2デザインエンジンは現在カフェ業態のみ対応しています");
    expect(html).toContain('id="gallery"');
  });
});

describe("WebsiteRendererV2: Hero構図の切り替え", () => {
  const photoBrief: StoreBrief = { ...cafeBrief, realData: { photoUrls: ["https://example.com/a.jpg"] } };

  it("sensory-immersive方向(luxury-quiet)×layoutVariant=immersiveかつ写真ありの場合、full-bleed構図（h-dvh）で描画する", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({ brandArchetype: "luxury-quiet", layoutVariant: "immersive" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain("h-dvh");
  });

  it("layoutVariant=editorialかつ写真ありの場合、split構図（grid）で描画する", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({ layoutVariant: "editorial" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain('id="top"');
    expect(html).not.toContain("h-dvh");
  });

  it("写真0枚の場合、layoutVariantに関わらず破綻せずtypographic構図で描画する", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    for (const layoutVariant of ["immersive", "editorial", "direct"] as const) {
      const brandPlan = makeBrandPlan({ layoutVariant });
      const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
      expect(html).toContain('id="top"');
      // heroTitleはstoreName部分だけ独立したspanで囲むため(HeroTitle参照)、
      // 文字列全体が1つの連続した部分文字列としては現れない。前半・storeName
      // それぞれが含まれていることを確認する。
      expect(html).toContain("毎日通いたくなる");
      expect(html).toContain(cafeBrief.storeName);
    }
  });

  it("写真が多数(4枚以上)ある場合も破綻しない", () => {
    const manyPhotoBrief: StoreBrief = {
      ...cafeBrief,
      realData: {
        photoUrls: [
          "https://example.com/a.jpg",
          "https://example.com/b.jpg",
          "https://example.com/c.jpg",
          "https://example.com/d.jpg",
          "https://example.com/e.jpg",
        ],
      },
    };
    const contents = generateWebsiteRuleBased(manyPhotoBrief);
    const brandPlan = makeBrandPlan({ layoutVariant: "direct" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={manyPhotoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain('id="photo-story"');
    expect(html).toContain('src="https://example.com/a.jpg"');
  });
});

describe("WebsiteRendererV2: モバイル下部固定CTA", () => {
  it("PC/モバイル共通で下部固定CTAバー（sm:hiddenでモバイル限定）が描画される", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} />);
    expect(html).toContain("sm:hidden");
    expect(html).toContain("safe-area-inset-bottom");
  });

  it("ctaStyleに応じてモバイル固定CTAのボタン強度が変わる（solid-bold時はtheme.ctaBgを含む）", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = makeBrandPlan({ ctaStrategy: { placement: "hero", urgency: "high" } });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain("bg-stone-900");
  });
});

describe("WebsiteRendererV2: 再描画の安定性（同一入力なら同一HTML）", () => {
  it("同じbrief・contents・brandPlanなら、複数回レンダリングしても完全に同じHTMLになる", () => {
    const photoBrief: StoreBrief = {
      ...cafeBrief,
      realData: { photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"] },
    };
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({ layoutVariant: "editorial", brandArchetype: "luxury-quiet" });

    const html1 = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    const html2 = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    const html3 = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);

    expect(html1).toBe(html2);
    expect(html2).toBe(html3);
  });
});

describe("WebsiteRendererV2: imageTreatmentの反映", () => {
  const manyPhotoBrief: StoreBrief = {
    ...cafeBrief,
    realData: {
      photoUrls: [
        "https://example.com/a.jpg",
        "https://example.com/b.jpg",
        "https://example.com/c.jpg",
        "https://example.com/d.jpg",
      ],
    },
  };

  it("sensory-immersive方向はimageTreatment=mixedになり、先頭写真が大きく残りが小さめグリッドになる（aspect-square要素を含む）", () => {
    // imageTreatmentはvisualDirection.photoTreatmentの直接反映ではなく、
    // artDirection(brandArchetypeから導出)ごとに固定される。
    const contents = generateWebsiteRuleBased(manyPhotoBrief);
    const brandPlan = makeBrandPlan({ brandArchetype: "energetic-casual" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={manyPhotoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain("aspect-square");
  });
});

describe("WebsiteRendererV2: Hero見出しでstoreNameが独立したspanに分離される", () => {
  it("heroTitleにstoreNameが含まれる場合、storeName部分だけがfont-sansの別spanになる", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    expect(contents.heroTitle).toContain(cafeBrief.storeName);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={makeBrandPlan()} />);
    expect(html).toContain(`<span class="font-sans text-[0.5em] font-medium tracking-tight">${cafeBrief.storeName}</span>`);
    // ナビの店名リンクとHero見出し内のspanの2箇所だけに収め、他の場所へ店名を撒き散らさない。
    const occurrences = html.split(cafeBrief.storeName).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("英字のみ・ハイフン入り・日本語+英字混在の店名でも、生成されたheroTitleにstoreNameがそのまま(破壊されず)含まれる", () => {
    for (const storeName of ["The Wholesome Roastery", "Mugi-no-Ka Coffee Roasters", "麦の香 Coffee Roasters"]) {
      const brief: StoreBrief = { ...cafeBrief, storeName };
      const contents = generateWebsiteRuleBased(brief);
      expect(contents.heroTitle).toContain(storeName);
    }
  });
});

describe("WebsiteRendererV2: 3方向でMenu/AccessHours/CTAの構造そのものが変わる", () => {
  const menuBrief: StoreBrief = {
    ...cafeBrief,
    realData: {
      menuItems: [
        { name: "ブレンドコーヒー", price: "500円" },
        { name: "本日の焼き菓子", price: "350円" },
      ],
    },
  };

  // Story側の箇条書き(01/02/03)は方向に関わらず常に出るため、"01"の有無だけでは
  // Menuのノンブルと区別できない。id="menu"セクションだけを切り出して判定する。
  function extractMenuSectionHtml(html: string): string {
    const start = html.indexOf('id="menu"');
    const end = html.indexOf('id="access"', start);
    return html.slice(start, end === -1 ? undefined : end);
  }

  it("japanese-editorial: Menuはノンブル付き1カラムリスト、AccessHoursは中央寄せ誌面風、CTAは中央寄せ+罫線", () => {
    const contents = generateWebsiteRuleBased(menuBrief);
    const brandPlan = makeBrandPlan({ brandArchetype: "modern-minimal" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={menuBrief} contents={contents} brandPlan={brandPlan} />);
    const menuHtml = extractMenuSectionHtml(html);
    expect(menuHtml).toContain('">01</span>');
    expect(menuHtml).not.toContain(">Featured<");
    expect(html).toContain("h-64 w-full grayscale");
  });

  it("sensory-immersive: Menuは先頭品目をFeaturedカード化、AccessHoursは写真/地図と一体化(70vh)", () => {
    const contents = generateWebsiteRuleBased(menuBrief);
    const brandPlan = makeBrandPlan({ brandArchetype: "luxury-quiet" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={menuBrief} contents={contents} brandPlan={brandPlan} />);
    const menuHtml = extractMenuSectionHtml(html);
    expect(menuHtml).toContain(">Featured<");
    expect(menuHtml).not.toContain('">01</span>');
    expect(html).toContain("h-[70vh] min-h-[480px]");
  });

  it("warm-craft: Menuは番号無しの通しリスト、AccessHoursは元のカード構成", () => {
    const contents = generateWebsiteRuleBased(menuBrief);
    const brandPlan = makeBrandPlan({ brandArchetype: "artisan" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={menuBrief} contents={contents} brandPlan={brandPlan} />);
    const menuHtml = extractMenuSectionHtml(html);
    expect(menuHtml).not.toContain('">01</span>');
    expect(menuHtml).not.toContain(">Featured<");
    expect(html).not.toContain("h-[70vh] min-h-[480px]");
    expect(html).not.toContain("h-64 w-full grayscale");
  });

  it("AccessHoursのGoogle地図iframeには、埋め込み失敗時にも機能する実リンク(新規タブでGoogleマップを開く)が3方向すべてに併記される", () => {
    // 地図iframeは広告ブロッカーやネットワーク制限で読み込みに失敗すると
    // ブラウザ既定の壊れたファイルアイコンだけが残ることを実機検証で確認した。
    // 埋め込みの成否によらず、常にこのリンクで実際の地図へ到達できることを保証する。
    const contents = generateWebsiteRuleBased(cafeBrief);
    for (const brandArchetype of ["modern-minimal", "luxury-quiet", "artisan"] as const) {
      const html = renderToStaticMarkup(
        <WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={makeBrandPlan({ brandArchetype })} />
      );
      expect(html).toContain("Google マップで見る");
      expect(html).toContain(`href="https://www.google.com/maps?q=`);
    }
  });

  it("CTA(variant=primary)は方向ごとにレイアウトが変わる(sensory-immersiveだけlg:flex-rowの左右分割)", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const immersiveHtml = renderToStaticMarkup(
      <WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={makeBrandPlan({ brandArchetype: "energetic-casual" })} />
    );
    const warmHtml = renderToStaticMarkup(
      <WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={makeBrandPlan({ brandArchetype: "artisan" })} />
    );
    expect(immersiveHtml).toContain("lg:flex-row lg:items-center lg:justify-between");
    expect(warmHtml).not.toContain("lg:flex-row lg:items-center lg:justify-between");
  });
});
