import { describe, it, expect } from "vitest";
import { buildSite, extractAppeal } from "@/lib/site";
import { generateSlug, slugifyCore } from "@/lib/site/slug";
import { SiteDocumentSchema } from "@/lib/site/schema";
import { buildSeo } from "@/lib/site/seo";

const store = {
  name: "サンセットリゾートカフェ",
  category: "cafe",
  area: "恩納村",
  address: "沖縄県恩納村1-1",
  phone: "098-000-0000",
  opening_hours: { weekday_text: ["毎日 8:00-20:00"] },
  rating: 4.7,
  review_count: 540,
  photo_count: 0,
  website_url: null,
  instagram_url: null,
  facebook_url: null,
};

describe("slug", () => {
  it("英数slugを生成し、日本語のみはフォールバック", () => {
    expect(slugifyCore("Sunset Cafe")).toBe("sunset-cafe");
    expect(slugifyCore("海カフェ")).toBe("");
    const s = generateSlug("海カフェ", "seed-1");
    expect(s.startsWith("store-")).toBe(true);
  });

  it("衝突時は連番で回避する", () => {
    const existing = new Set<string>();
    const a = generateSlug("Cafe", "addr-1", existing);
    existing.add(a);
    const b = generateSlug("Cafe", "addr-1", existing);
    expect(a).not.toBe(b);
  });
});

describe("buildSeo", () => {
  it("title/descriptionを生成し長さを抑える", () => {
    const seo = buildSeo({ name: "海風食堂", category: "restaurant", area: "那覇市" });
    expect(seo.title).toContain("海風食堂");
    expect(seo.title.length).toBeLessThanOrEqual(60);
    expect(seo.description.length).toBeLessThanOrEqual(120);
  });
});

describe("extractAppeal", () => {
  it("口コミ要約から先頭の訴求を取り出す", () => {
    expect(extractAppeal("景色が最高。料理も美味しい")).toBe("景色が最高");
    expect(extractAppeal(null)).toBeNull();
  });
});

describe("buildSite", () => {
  it("6ページ構成のサイトを生成しschemaに適合する", () => {
    const { slug, document } = buildSite({ store });
    expect(slug.length).toBeGreaterThan(0);
    expect(document.pages.length).toBe(6);
    // TOP/紹介/メニュー/アクセス/FAQ/問い合わせ
    const slugs = document.pages.map((p) => p.slug);
    expect(slugs).toContain(""); // TOP
    expect(slugs).toContain("access");
    expect(slugs).toContain("faq");
    // 写真0枚 → フォールバック
    expect(document.usedPhotoFallback).toBe(true);
    // JSON schema 検証
    expect(SiteDocumentSchema.safeParse(document).success).toBe(true);
  });

  it("カフェ×観光地はリゾートテーマが選ばれやすい", () => {
    const { document } = buildSite({ store });
    expect(["resort", "natural", "modern"]).toContain(document.themeType);
  });

  it("メニュー未提供時は仮説フラグが立つ", () => {
    const { document } = buildSite({ store });
    const menu = document.pages.find((p) => p.slug === "menu");
    const menuSection = menu?.sections.find((s) => s.type === "menu");
    expect(menuSection?.isHypothesis).toBe(true);
  });
});
