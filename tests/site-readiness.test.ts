import { describe, expect, it } from "vitest";
import { assessSiteReadiness } from "@/lib/site-readiness";
import type { Store } from "@/lib/types";

const baseStore: Store = { id: "store-1", tenant_id: null, place_id: "place-1", name: "Cafe Test", category: "cafe", address: null, phone: null, opening_hours: null, rating: null, review_count: 0, photo_count: 0, website_url: null, instagram_url: null, facebook_url: null, has_website: false, area: "那覇市", source: "google_places", raw_payload: {}, created_at: "2026-01-01", updated_at: "2026-01-01" };

describe("assessSiteReadiness", () => {
  it("does not award readiness when verified business data is missing", () => {
    const result = assessSiteReadiness(baseStore, [], false);
    expect(result.score).toBe(0);
    expect(result.level).toBe("needs-content");
  });
  it("marks a store ready when core contact, menu, photo and trust data exist", () => {
    const store: Store = { ...baseStore, address: "沖縄県那覇市1-2-3", phone: "098-000-0000", opening_hours: { weekday_text: ["月曜日: 9:00〜18:00"] }, rating: 4.7, review_count: 120, photo_count: 6, instagram_url: "https://instagram.com/example" };
    const menu = ["コーヒー", "ラテ", "チーズケーキ"].map((name, index) => ({ name, price: `${500 + index * 50}円`, imageUrl: `https://example.com/${index}.jpg` }));
    const result = assessSiteReadiness(store, menu, true);
    expect(result.score).toBe(100);
    expect(result.level).toBe("ready");
    expect(result.nextActions).toEqual([]);
  });
  it("keeps menu photo and price requirements separate", () => {
    const result = assessSiteReadiness(baseStore, ["A", "B", "C"].map((name) => ({ name })), false);
    expect(result.items.find((item) => item.id === "menu")?.complete).toBe(true);
    expect(result.items.find((item) => item.id === "prices")?.complete).toBe(false);
    expect(result.items.find((item) => item.id === "menu-photos")?.complete).toBe(false);
  });
});
