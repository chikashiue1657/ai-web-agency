import { describe, it, expect } from "vitest";
import {
  normalizeGooglePlace,
  normalizeApify,
  normalizeCsvRow,
  decideHasWebsite,
} from "@/lib/normalize";
import { normalizeCategory, inferArea, similarity } from "@/lib/normalize/helpers";

describe("normalizeGooglePlace", () => {
  it("Google Places形式を正規化する", () => {
    const n = normalizeGooglePlace({
      place_id: "abc",
      name: "海カフェ",
      types: ["cafe", "food"],
      formatted_address: "沖縄県那覇市1-1",
      formatted_phone_number: "098-111-2222",
      opening_hours: { weekday_text: ["月 9:00-18:00"] },
      rating: 4.6,
      user_ratings_total: 120,
      photos: [{}, {}, {}],
      website: "https://umi-cafe.example.com",
      url: "https://maps.google.com/?cid=1",
    });
    expect(n.place_id).toBe("abc");
    expect(n.category).toBe("cafe");
    expect(n.rating).toBe(4.6);
    expect(n.review_count).toBe(120);
    expect(n.photo_count).toBe(3);
    expect(n.website_url).toBe("https://umi-cafe.example.com");
    expect(n.has_website).toBe(true);
    expect(n.area).toBe("那覇市");
    expect(n.source).toBe("google_places");
  });

  it("Googleマップのurlのみ(公式HP無し)では has_website=false", () => {
    const n = normalizeGooglePlace({
      name: "X",
      url: "https://maps.google.com/?cid=1",
    });
    expect(n.has_website).toBe(false);
    expect(n.website_url).toBeNull();
  });
});

describe("normalizeApify", () => {
  it("Apify形式の揺れたフィールドを吸収する", () => {
    const n = normalizeApify({
      placeId: "p1",
      title: "美らサロン",
      categoryName: "Beauty salon",
      address: "沖縄県北谷町美浜2-1",
      phoneUnformatted: "0980001111",
      totalScore: 4.1,
      reviewsCount: 33,
      imagesCount: 10,
      instagram: "https://instagram.com/chura",
    });
    expect(n.name).toBe("美らサロン");
    expect(n.category).toBe("beauty");
    expect(n.review_count).toBe(33);
    expect(n.photo_count).toBe(10);
    expect(n.instagram_url).toBe("https://instagram.com/chura");
    expect(n.area).toBe("北谷町");
  });
});

describe("normalizeCsvRow", () => {
  it("ヘッダ揺れ(日本語/英語)を吸収する", () => {
    const n = normalizeCsvRow({
      店名: "そば処てぃーだ",
      業種: "そば",
      住所: "沖縄県名護市1-2",
      電話番号: "0980-00-0000",
      評価: "4.3",
      口コミ数: "85件",
      写真数: "4",
      ホームページ: "",
    });
    expect(n.name).toBe("そば処てぃーだ");
    expect(n.category).toBe("restaurant");
    expect(n.rating).toBe(4.3);
    expect(n.review_count).toBe(85); // "85件" のノイズ除去
    expect(n.has_website).toBe(false);
    expect(n.area).toBe("名護市");
  });

  it("欠損値に強い（最低限nameは確保）", () => {
    const n = normalizeCsvRow({});
    expect(n.name).toBe("(名称不明)");
    expect(n.review_count).toBe(0);
    expect(n.rating).toBeNull();
  });
});

describe("helpers", () => {
  it("normalizeCategory", () => {
    expect(normalizeCategory("ramen restaurant")).toBe("restaurant");
    expect(normalizeCategory("歯科")).toBe("clinic");
    expect(normalizeCategory("民宿")).toBe("hotel");
    expect(normalizeCategory("unknown thing")).toBe("other");
  });

  it("inferArea: 明示指定を優先", () => {
    expect(inferArea("沖縄県那覇市1-1", "うるま市")).toBe("うるま市");
    expect(inferArea("沖縄県中頭郡北谷町美浜")).toBe("北谷町");
  });

  it("similarity: 近似一致", () => {
    expect(similarity("海カフェ 那覇市おもろまち", "海カフェ 那覇市おもろまち")).toBe(1);
    expect(similarity("海カフェ", "全く別の名前XYZ")).toBeLessThan(0.3);
  });

  it("decideHasWebsite", () => {
    expect(decideHasWebsite("https://shop.example.com")).toBe(true);
    expect(decideHasWebsite(null)).toBe(false);
    expect(decideHasWebsite("https://instagram.com/x")).toBe(false);
  });
});
