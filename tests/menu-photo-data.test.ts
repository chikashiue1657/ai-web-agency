import { describe, expect, it } from "vitest";
import { buildStoreRealData } from "@/lib/neumos/store-real-data";
import type { Store } from "@/lib/types";

function storeWithMenu(menu: unknown[]): Store {
  return {
    id: "store-1", tenant_id: null, place_id: null, name: "Cafe", category: "cafe",
    address: null, phone: null, opening_hours: null, rating: null, review_count: 0,
    photo_count: 0, website_url: null, instagram_url: null, facebook_url: null,
    has_website: false, area: null, source: "manual",
    raw_payload: { _neumosMenuItems: menu }, created_at: "", updated_at: "",
  };
}

describe("menu photo data handoff", () => {
  it("sends only the public HTTPS URL to Neumos", () => {
    const result = buildStoreRealData(storeWithMenu([{
      id: "internal-id", name: "Latte", imagePath: "stores/store-1/menu/a.jpg",
      imageUrl: "https://project.supabase.co/storage/v1/object/public/menu-images/stores/store-1/menu/a.jpg",
    }]));
    expect(result?.menuItems).toEqual([{
      name: "Latte",
      imageUrl: "https://project.supabase.co/storage/v1/object/public/menu-images/stores/store-1/menu/a.jpg",
    }]);
  });

  it("drops unsafe image URLs without dropping the item", () => {
    expect(buildStoreRealData(storeWithMenu([{ name: "Latte", imageUrl: "javascript:alert(1)" }]))?.menuItems)
      .toEqual([{ name: "Latte" }]);
  });
});
