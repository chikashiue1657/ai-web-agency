import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/places/photo/route";

describe("GET /api/places/photo", () => {
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  });

  it("placeIdから最新の写真名を取得し、画像へリダイレクトする", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ photos: [{ name: "places/place-1/photos/current" }] }))
      .mockResolvedValueOnce(Response.json({ photoUri: "https://images.example.com/photo.jpg" }));

    const response = await GET(new Request(
      "http://localhost/api/places/photo?placeId=place-1&w=800&i=0"
    ));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://images.example.com/photo.jpg");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("旧name形式でも保存済み写真名を使わず、placeIdから最新情報を取り直す", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ photos: [
        { name: "places/place-1/photos/new-1" },
        { name: "places/place-1/photos/new-2" },
      ] }))
      .mockResolvedValueOnce(Response.json({ photoUri: "https://images.example.com/new-2.jpg" }));

    const response = await GET(new Request(
      "http://localhost/api/places/photo?name=places%2Fplace-1%2Fphotos%2Fold&w=800&i=1"
    ));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://images.example.com/new-2.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://places.googleapis.com/v1/places/place-1");
  });

  it("meta=1では作者表示と個別のGoogle Mapsリンクを返し、画像APIは呼ばない", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ photos: [{
      name: "places/place-1/photos/current",
      googleMapsUri: "https://maps.google.com/photo/1",
      authorAttributions: [{ displayName: "撮影者", uri: "https://maps.google.com/user/1" }],
    }] }));
    const response = await GET(new Request("http://localhost/api/places/photo?placeId=place-1&i=0&meta=1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      googleMapsUri: "https://maps.google.com/photo/1",
      authorAttributions: [{ displayName: "撮影者", uri: "https://maps.google.com/user/1" }],
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid photo name before contacting Google", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(new Request("http://localhost/api/places/photo?name=invalid"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
