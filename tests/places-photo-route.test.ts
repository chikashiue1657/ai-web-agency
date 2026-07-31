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

  it("redirects a valid photo name without an extra API call", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ photoUri: "https://images.example.com/photo.jpg" })
    );

    const response = await GET(new Request(
      "http://localhost/api/places/photo?name=places%2Fplace-1%2Fphotos%2Fphoto-1&w=800&i=0"
    ));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://images.example.com/photo.jpg");
    expect(response.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired photo name through Place Details and retries once", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ error: "expired" }, { status: 400 }))
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://places.googleapis.com/v1/places/place-1");
  });

  it("rejects an invalid photo name before contacting Google", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(new Request("http://localhost/api/places/photo?name=invalid"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
