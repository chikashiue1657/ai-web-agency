import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Jimp, rgbaToInt } from "jimp";
import { WebsiteRendererV2 } from "@/components/website-v2/WebsiteRendererV2";
import { filterArtifacts } from "@/lib/editorial/filter";
import { compressArtifacts } from "@/lib/editorial/compress";
import { arrangeArtifacts } from "@/lib/editorial/arrange";
import { toRenderables } from "@/lib/editorial/renderable";
import { assignPresentation } from "@/lib/editorial/presentation";
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";

function makeBrief(overrides: Partial<StoreBrief> = {}): StoreBrief {
  return {
    storeName: "BB-Coffee",
    industry: "カフェ",
    area: "沖縄市",
    targetCustomer: "地域客",
    mainProblem: "新規客が少ない",
    salesAngle: "焙煎香る店内",
    websiteGoal: "来店増加",
    siteConcept: "居心地の良いサイト",
    recommendedPages: [],
    seoKeywords: [],
    tone: "親しみやすい",
    offer: "本日の一杯",
    ...overrides,
  };
}

function makeContents(overrides: Partial<GeneratedWebsiteContents> = {}): GeneratedWebsiteContents {
  return {
    concept: "焙煎したての香りが漂う店内。",
    heroTitle: "香りに包まれる、いつもの一杯へ",
    heroSubtitle: "焙煎したての豆で淹れる、毎日通いたくなるカフェ。",
    sections: [],
    gallery: [],
    access: { areaLabel: "沖縄市", addressHint: "沖縄市内", mapQuery: "BB-Coffee 沖縄市" },
    contactMethods: [],
    cta: { headline: "見出し", body: "本文", buttonLabel: "予約する", href: "#contact" },
    seoTitle: "title",
    metaDescription: "description",
    faq: [],
    instagramCaption: "caption",
    googleBusinessImprovement: [],
    strategy: { strengths: [], challenges: [], targetPersona: "persona", differentiators: [] },
    ...overrides,
  };
}

async function buildEditorialPreview(brief: StoreBrief, contents: GeneratedWebsiteContents, requestId = "test") {
  const { editorial, utility } = filterArtifacts(brief, contents);
  const { artifacts: compressed } = await compressArtifacts(editorial);
  const arranged = arrangeArtifacts(compressed, undefined, requestId);
  const presented = assignPresentation(toRenderables(arranged));
  return { presented, utility };
}

async function makePngBuffer(): Promise<Buffer> {
  const img = new Jimp({ width: 20, height: 20, color: 0x000000ff });
  img.setPixelColor(rgbaToInt(200, 200, 200, 255), 5, 5);
  return img.getBuffer("image/png");
}

function stubFetchReturning(buf: Buffer) {
  const original = global.fetch;
  global.fetch = vi.fn(async () => new Response(new Uint8Array(buf), { status: 200 })) as typeof fetch;
  return () => {
    global.fetch = original;
  };
}

let restoreFetch: (() => void) | null = null;
afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

describe("WebsiteRendererV2 (editorialPreview branch)", () => {
  it("editorialPreview省略時は従来通りの描画になる(既存回帰)", () => {
    const brief = makeBrief();
    const contents = makeContents();
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).toContain(brief.storeName);
    expect(html).not.toContain("data-primitive");
  });

  it("写真0枚でも成立する(Utility Layerは常に表示される)", async () => {
    const brief = makeBrief();
    const contents = makeContents();
    const preview = await buildEditorialPreview(brief, contents);
    const html = renderToStaticMarkup(
      <WebsiteRendererV2 brief={brief} contents={contents} editorialPreview={preview} />
    );
    expect(html).toContain(brief.storeName);
    expect(html).toContain(contents.cta.buttonLabel); // UtilityLayerV2のCTAV2由来
  });

  it("Editorial Artifactが空(concept含め全て空)でもページが成立し、Utility Layerは表示される", async () => {
    const brief = makeBrief();
    const contents = makeContents({ concept: "", cta: { headline: "見出し", body: "本文", buttonLabel: "電話する", href: "tel:0980000000" } });
    const preview = await buildEditorialPreview(brief, contents);
    expect(preview.presented).toHaveLength(0);
    const html = renderToStaticMarkup(
      <WebsiteRendererV2 brief={brief} contents={contents} editorialPreview={preview} />
    );
    expect(html).toContain("電話する");
  });

  it("写真1枚でも成立する", async () => {
    const buf = await makePngBuffer();
    restoreFetch = stubFetchReturning(buf);
    const brief = makeBrief({ realData: { photoUrls: ["https://example.test/a.jpg"] } });
    const contents = makeContents();
    const preview = await buildEditorialPreview(brief, contents);
    const html = renderToStaticMarkup(
      <WebsiteRendererV2 brief={brief} contents={contents} editorialPreview={preview} />
    );
    expect(html).toContain('data-primitive');
    expect(html).toContain("https://example.test/a.jpg");
  });

  it("写真12枚でも成立する", async () => {
    const buf = await makePngBuffer();
    restoreFetch = stubFetchReturning(buf);
    const photoUrls = Array.from({ length: 12 }, (_, i) => `https://example.test/photo-${i}.jpg`);
    const brief = makeBrief({ realData: { photoUrls } });
    const contents = makeContents();
    const preview = await buildEditorialPreview(brief, contents);
    const html = renderToStaticMarkup(
      <WebsiteRendererV2 brief={brief} contents={contents} editorialPreview={preview} />
    );
    expect(html).toContain(brief.storeName);
  });

  it("実データに無い電話番号・住所を捏造しない", async () => {
    const brief = makeBrief(); // realData無し
    const contents = makeContents();
    const preview = await buildEditorialPreview(brief, contents);
    const html = renderToStaticMarkup(
      <WebsiteRendererV2 brief={brief} contents={contents} editorialPreview={preview} />
    );
    expect(html).not.toContain("098-");
    expect(html).not.toMatch(/〒\d{3}/);
  });

  it("header/main/footerの基本構造が崩れない", async () => {
    const brief = makeBrief();
    const contents = makeContents();
    const preview = await buildEditorialPreview(brief, contents);
    const html = renderToStaticMarkup(
      <WebsiteRendererV2 brief={brief} contents={contents} editorialPreview={preview} />
    );
    expect(html).toContain("<header");
    expect(html).toContain("<main");
    expect(html).toContain("<footer");
  });
});
