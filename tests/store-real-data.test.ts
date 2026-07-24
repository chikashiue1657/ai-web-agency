import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { buildStoreRealData } from "@/lib/neumos/store-real-data";
import type { Store } from "@/lib/types";

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: "store-1",
    tenant_id: null,
    place_id: "place-1",
    name: "テスト店",
    category: "cafe",
    address: null,
    phone: null,
    opening_hours: null,
    rating: null,
    review_count: 0,
    photo_count: 0,
    website_url: null,
    instagram_url: null,
    facebook_url: null,
    has_website: false,
    area: "那覇市",
    source: "google_places",
    raw_payload: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildStoreRealData", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.NEXT_PUBLIC_SITE_BASE_URL;
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("何も実データが無い場合はundefinedを返す（捏造しない）", () => {
    expect(buildStoreRealData(makeStore())).toBeUndefined();
  });

  it("取得できているフィールドだけをrealDataに含める", () => {
    const store = makeStore({
      address: "沖縄県那覇市おもろまち1-2-3",
      phone: "098-000-0001",
      opening_hours: { weekday_text: ["月-金 11:00-22:00"] },
      instagram_url: "https://instagram.com/example",
      rating: 4.5,
      review_count: 320,
    });
    const realData = buildStoreRealData(store);
    expect(realData).toEqual({
      address: "沖縄県那覇市おもろまち1-2-3",
      phone: "098-000-0001",
      openingHours: ["月-金 11:00-22:00"],
      instagramUrl: "https://instagram.com/example",
      googleRating: 4.5,
      googleReviewCount: 320,
    });
  });

  it("一部フィールドのみ取得できている場合はその項目だけ含める", () => {
    const store = makeStore({ address: "沖縄県浦添市1-1-1" });
    expect(buildStoreRealData(store)).toEqual({ address: "沖縄県浦添市1-1-1" });
  });

  it("GOOGLE_PLACES_API_KEY未設定時は写真URLを組み立てない（壊れたURLを埋め込まない）", () => {
    process.env.NEXT_PUBLIC_SITE_BASE_URL = "https://ai-web-agency.example.com";
    const store = makeStore({
      address: "沖縄県那覇市1-1-1",
      raw_payload: { photos: [{ name: "places/abc/photos/xyz" }] },
    });
    const realData = buildStoreRealData(store);
    expect(realData?.photoUrls).toBeUndefined();
  });

  it("APIキー・ベースURLがあり、有効な写真参照がある場合はプロキシURLを組み立てる", () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_SITE_BASE_URL = "https://ai-web-agency.example.com/";
    const store = makeStore({
      address: "沖縄県那覇市1-1-1",
      raw_payload: {
        photos: [{ name: "places/abc/photos/xyz" }, { name: "invalid-format" }, { notName: true }],
      },
    });
    const realData = buildStoreRealData(store);
    expect(realData?.photoUrls).toEqual([
      "https://ai-web-agency.example.com/api/places/photo?name=places%2Fabc%2Fphotos%2Fxyz&w=800",
    ]);
  });

  it("source が google_places 以外なら写真URLを組み立てない", () => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_SITE_BASE_URL = "https://ai-web-agency.example.com";
    const store = makeStore({
      address: "沖縄県那覇市1-1-1",
      source: "manual",
      raw_payload: { photos: [{ name: "places/abc/photos/xyz" }] },
    });
    expect(buildStoreRealData(store)?.photoUrls).toBeUndefined();
  });
});
