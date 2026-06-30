import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  isInstagramUrl,
  isFacebookUrl,
  looksLikeOfficialWebsite,
  extractUrls,
} from "@/lib/normalize/url";

describe("normalizeUrl", () => {
  it("補完: スキーム無しのドメインに https を付ける", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("www.example.com/")).toBe("https://www.example.com");
  });

  it("トラッキングパラメータを除去する", () => {
    expect(normalizeUrl("https://a.com/p?utm_source=x&id=1")).toBe(
      "https://a.com/p?id=1"
    );
  });

  it("無効値は null", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(123)).toBeNull();
  });
});

describe("SNS判定", () => {
  it("Instagram / Facebook を判定", () => {
    expect(isInstagramUrl("https://instagram.com/foo")).toBe(true);
    expect(isInstagramUrl("https://www.instagram.com/foo")).toBe(true);
    expect(isFacebookUrl("https://facebook.com/foo")).toBe(true);
    expect(isFacebookUrl("https://m.facebook.com/foo")).toBe(true);
    expect(isInstagramUrl("https://example.com")).toBe(false);
  });
});

describe("looksLikeOfficialWebsite", () => {
  it("ポータル/SNSは公式サイトとみなさない", () => {
    expect(looksLikeOfficialWebsite("https://tabelog.com/x")).toBe(false);
    expect(looksLikeOfficialWebsite("https://instagram.com/x")).toBe(false);
    expect(looksLikeOfficialWebsite("https://maps.google.com/x")).toBe(false);
    expect(looksLikeOfficialWebsite("https://my-shop.example.com")).toBe(true);
  });
});

describe("extractUrls", () => {
  it("混在した候補から公式/IG/FBを振り分ける", () => {
    const r = extractUrls(
      "https://my-cafe.example.com",
      ["https://instagram.com/mycafe", "https://facebook.com/mycafe"],
      "https://tabelog.com/should-be-ignored-as-website"
    );
    expect(r.website_url).toBe("https://my-cafe.example.com");
    expect(r.instagram_url).toBe("https://instagram.com/mycafe");
    expect(r.facebook_url).toBe("https://facebook.com/mycafe");
  });

  it("文中の複数URLも抽出する", () => {
    const r = extractUrls("予約はこちら https://shop.example.com もどうぞ");
    expect(r.website_url).toBe("https://shop.example.com");
  });
});
