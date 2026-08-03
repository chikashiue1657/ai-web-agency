import { describe, expect, it } from "vitest";
import { detectMenuPhotoMime, isStoreMenuPhotoPath } from "@/lib/menu-photos";

describe("menu photo validation", () => {
  it("detects JPEG, PNG and WebP by file signature", () => {
    expect(detectMenuPhotoMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectMenuPhotoMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectMenuPhotoMime(Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]))).toBe("image/webp");
  });

  it("rejects renamed text files and cross-store paths", () => {
    expect(detectMenuPhotoMime(new TextEncoder().encode("not an image"))).toBeNull();
    expect(isStoreMenuPhotoPath("store-a", "stores/store-a/menu/photo.jpg")).toBe(true);
    expect(isStoreMenuPhotoPath("store-a", "stores/store-b/menu/photo.jpg")).toBe(false);
    expect(isStoreMenuPhotoPath("store-a", "stores/store-a/menu/../secret.jpg")).toBe(false);
  });

  it("rejects store IDs containing path separators", () => {
    expect(isStoreMenuPhotoPath("../other", "stores/../other/menu/photo.jpg")).toBe(false);
    expect(isStoreMenuPhotoPath("store/other", "stores/store/other/menu/photo.jpg")).toBe(false);
  });
});
