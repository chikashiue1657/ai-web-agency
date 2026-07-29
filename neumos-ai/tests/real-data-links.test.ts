import { describe, expect, it } from "vitest";
import { buildCtaWithRealLinks, buildContactMethodsWithRealLinks, resolveGoogleMapsUrl } from "@/lib/engine/real-data-links";
import type { StoreBrief } from "@/lib/types";

function makeBrief(overrides: Partial<StoreBrief> = {}): StoreBrief {
  return {
    storeName: "テスト店",
    industry: "カフェ",
    area: "那覇市",
    targetCustomer: "地域客",
    mainProblem: "新規客が少ない",
    salesAngle: "検索流入の確立",
    websiteGoal: "予約増加",
    siteConcept: "居心地の良いサイト",
    recommendedPages: [],
    seoKeywords: [],
    tone: "親しみやすい",
    offer: "初回無料",
    ...overrides,
  };
}

describe("buildCtaWithRealLinks", () => {
  it("realDataが無ければ、業種に依らず正直な汎用CTA（#contact）になる", () => {
    const cta = buildCtaWithRealLinks("headline", "body", makeBrief());
    expect(cta.href).toBe("#contact");
    expect(cta.buttonLabel).toBe("お問い合わせする");
  });

  it("phoneがあればtel:リンク＋業種別ラベルになる", () => {
    const cta = buildCtaWithRealLinks("h", "b", makeBrief({ realData: { phone: "098-111-2222" } }));
    expect(cta.href).toBe("tel:098-111-2222");
    expect(cta.buttonLabel).toBe("電話で予約する");
  });

  it("headline/bodyは常にそのまま使う", () => {
    const cta = buildCtaWithRealLinks("見出し", "本文", makeBrief());
    expect(cta.headline).toBe("見出し");
    expect(cta.body).toBe("本文");
  });

  it("美容室はLINEデータを扱わないため、電話が無ければ汎用フォールバックになる（LINEを捏造しない）", () => {
    const cta = buildCtaWithRealLinks("h", "b", makeBrief({ industry: "美容室" }));
    expect(cta.buttonLabel).not.toContain("LINE");
    expect(cta.href).toBe("#contact");
  });
});

describe("buildContactMethodsWithRealLinks", () => {
  it("Googleマップ非対象の業種（整体）で実データが何も無ければ、正直な汎用フォールバック1件のみになる", () => {
    const methods = buildContactMethodsWithRealLinks(makeBrief({ industry: "整体院" }));
    expect(methods).toEqual([{ label: "お問い合わせする", href: "#contact" }]);
  });

  it("カフェは実データが無くても、店舗名+エリアのGoogleマップ検索リンクは案内として出す（実在の確認は主張しない）", () => {
    const methods = buildContactMethodsWithRealLinks(makeBrief({ industry: "カフェ" }));
    expect(methods).toEqual([
      { label: "Google マップで見る", href: expect.stringContaining("google.com/maps") },
    ]);
  });

  it("phoneがあればtel:リンク付きの項目が含まれる", () => {
    const methods = buildContactMethodsWithRealLinks(makeBrief({ realData: { phone: "098-111-2222" } }));
    expect(methods).toContainEqual({ label: "お電話でのお問い合わせ", href: "tel:098-111-2222" });
  });

  it("instagramUrlがあればその項目が含まれる", () => {
    const methods = buildContactMethodsWithRealLinks(
      makeBrief({ realData: { instagramUrl: "https://instagram.com/example" } })
    );
    expect(methods).toContainEqual({ label: "Instagramを見る", href: "https://instagram.com/example" });
  });

  it("instagramUrlが無ければInstagramの項目は出さない", () => {
    const methods = buildContactMethodsWithRealLinks(makeBrief({ realData: { phone: "098-111-2222" } }));
    expect(methods.some((m) => m.label.includes("Instagram"))).toBe(false);
  });

  it("整体（spa）はGoogleマップ項目を含めない業種設定になっている", () => {
    const methods = buildContactMethodsWithRealLinks(
      makeBrief({ industry: "整体院", realData: { phone: "098-111-2222" } })
    );
    expect(methods.some((m) => m.label.includes("マップ"))).toBe(false);
  });

  it("realData.googleMapsUrlがあれば、マップ項目のhrefはそのURLをそのまま使う（テキスト検索へ作り直さない）", () => {
    const methods = buildContactMethodsWithRealLinks(
      makeBrief({ industry: "カフェ", realData: { googleMapsUrl: "https://maps.google.com/?cid=999" } })
    );
    expect(methods).toContainEqual({ label: "Google マップで見る", href: "https://maps.google.com/?cid=999" });
  });

  it("websiteUrlがあれば「公式サイトを見る」が実URLで含まれる", () => {
    const methods = buildContactMethodsWithRealLinks(
      makeBrief({ realData: { websiteUrl: "https://example-cafe.jp" } })
    );
    expect(methods).toContainEqual({ label: "公式サイトを見る", href: "https://example-cafe.jp" });
  });

  it("websiteUrlが無ければ「公式サイトを見る」は出さない（架空の公式サイトURLを作らない）", () => {
    const methods = buildContactMethodsWithRealLinks(makeBrief({ realData: { phone: "098-111-2222" } }));
    expect(methods.some((m) => m.label.includes("公式サイト"))).toBe(false);
  });

  // 優先順位(電話→公式サイト→Instagram→Google Maps)の上位2件だけを表示することを
  // 固定するシナリオ群(A〜F)。件数は常にMAX_SECONDARY_METHODS(2)を超えない。
  it("A. websiteUrl無し・カフェ・phone＋instagramUrlありは、電話とInstagramの2件のみ(Google Mapsは出ない)", () => {
    const methods = buildContactMethodsWithRealLinks(
      makeBrief({
        industry: "カフェ",
        realData: { phone: "098-111-2222", instagramUrl: "https://instagram.com/example" },
      })
    );
    expect(methods).toEqual([
      { label: "お電話でのお問い合わせ", href: "tel:098-111-2222" },
      { label: "Instagramを見る", href: "https://instagram.com/example" },
    ]);
    expect(methods.length).toBe(2);
  });

  it("B. websiteUrlあり・カフェ・phone＋websiteUrl＋instagramUrlありは、電話と公式サイトの2件のみ(InstagramとGoogle Mapsは出ない)", () => {
    const methods = buildContactMethodsWithRealLinks(
      makeBrief({
        industry: "カフェ",
        realData: {
          phone: "098-111-2222",
          websiteUrl: "https://example-cafe.jp",
          instagramUrl: "https://instagram.com/example",
        },
      })
    );
    expect(methods).toEqual([
      { label: "お電話でのお問い合わせ", href: "tel:098-111-2222" },
      { label: "公式サイトを見る", href: "https://example-cafe.jp" },
    ]);
    expect(methods.length).toBe(2);
  });

  it("C. phone無し・websiteUrl＋instagramUrlありは、公式サイトとInstagramの2件のみ", () => {
    const methods = buildContactMethodsWithRealLinks(
      makeBrief({
        industry: "カフェ",
        realData: { websiteUrl: "https://example-cafe.jp", instagramUrl: "https://instagram.com/example" },
      })
    );
    expect(methods).toEqual([
      { label: "公式サイトを見る", href: "https://example-cafe.jp" },
      { label: "Instagramを見る", href: "https://instagram.com/example" },
    ]);
  });

  it("D. phone無し・websiteUrl無し・instagramUrlありは、Instagramと Google Mapsの2件", () => {
    const methods = buildContactMethodsWithRealLinks(
      makeBrief({ industry: "カフェ", realData: { instagramUrl: "https://instagram.com/example" } })
    );
    expect(methods.length).toBe(2);
    expect(methods[0]).toEqual({ label: "Instagramを見る", href: "https://instagram.com/example" });
    expect(methods[1].label).toBe("Google マップで見る");
  });

  it("E. 実データ無しのカフェは、Google Mapsのみ(検索案内として1件)", () => {
    const methods = buildContactMethodsWithRealLinks(makeBrief({ industry: "カフェ" }));
    expect(methods).toEqual([{ label: "Google マップで見る", href: expect.stringContaining("google.com/maps") }]);
  });

  it("F. mapShownFor=falseの業種(整体院)で実データ無しは、正直な汎用フォールバックのみ", () => {
    const methods = buildContactMethodsWithRealLinks(makeBrief({ industry: "整体院" }));
    expect(methods).toEqual([{ label: "お問い合わせする", href: "#contact" }]);
  });

  it("実データが多い場合でも上位2件だけを表示する（4候補すべて揃っていても2件に切り詰める）", () => {
    const methods = buildContactMethodsWithRealLinks(
      makeBrief({
        industry: "カフェ",
        realData: {
          phone: "098-111-2222",
          websiteUrl: "https://example-cafe.jp",
          instagramUrl: "https://instagram.com/example",
          googleMapsUrl: "https://maps.google.com/?cid=999",
        },
      })
    );
    expect(methods.length).toBe(2);
    expect(methods).toEqual([
      { label: "お電話でのお問い合わせ", href: "tel:098-111-2222" },
      { label: "公式サイトを見る", href: "https://example-cafe.jp" },
    ]);
  });
});

describe("resolveGoogleMapsUrl: Google Mapsリンクの優先順位", () => {
  const fallbackQuery = "テスト店 那覇市";

  it("1. realData.googleMapsUrlがあれば最優先でそのまま使う（検索URLへ作り直さない）", () => {
    const url = resolveGoogleMapsUrl(
      { googleMapsUrl: "https://maps.google.com/?cid=12345", address: "沖縄県那覇市1-1-1" },
      fallbackQuery
    );
    expect(url).toBe("https://maps.google.com/?cid=12345");
  });

  it("2. googleMapsUrlが無くrealData.addressがあれば、実住所の検索URLへフォールバックする", () => {
    const url = resolveGoogleMapsUrl({ address: "沖縄県那覇市おもろまち1-2-3" }, fallbackQuery);
    expect(url).toBe(`https://www.google.com/maps?q=${encodeURIComponent("沖縄県那覇市おもろまち1-2-3")}`);
  });

  it("3. googleMapsUrlもaddressも無ければ、fallbackQuery(storeName+area等)の検索URLへフォールバックする", () => {
    expect(resolveGoogleMapsUrl(undefined, fallbackQuery)).toBe(
      `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery)}`
    );
    expect(resolveGoogleMapsUrl({}, fallbackQuery)).toBe(
      `https://www.google.com/maps?q=${encodeURIComponent(fallbackQuery)}`
    );
  });

  it("架空のURLは作らない：realDataに何も無くてもfallbackQueryの範囲を超えた値を挿入しない", () => {
    const url = resolveGoogleMapsUrl(undefined, fallbackQuery);
    const decoded = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
    expect(decoded).toBe(fallbackQuery);
  });
});
