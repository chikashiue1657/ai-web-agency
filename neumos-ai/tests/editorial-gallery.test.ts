import { afterEach, describe, expect, it, vi } from "vitest";
import { Jimp, rgbaToInt } from "jimp";
import { deriveGalleryPhotoOrder } from "@/lib/editorial/gallery";

async function makeCheckerboard(opts: { size?: number; square?: number; invert?: boolean } = {}): Promise<Buffer> {
  const size = opts.size ?? 60;
  const square = opts.square ?? 10;
  const img = new Jimp({ width: size, height: size, color: 0x000000ff });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = (Math.floor(x / square) + Math.floor(y / square)) % 2;
      let v = cell === 0 ? 30 : 220;
      if (opts.invert) v = 255 - v;
      img.setPixelColor(rgbaToInt(v, v, v, 255), x, y);
    }
  }
  return img.getBuffer("image/png");
}

function stubFetchWithImages(buffersByUrl: Record<string, Buffer>) {
  const original = global.fetch;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const buf = buffersByUrl[url];
    if (!buf) throw new Error(`unexpected fetch: ${url}`);
    return new Response(new Uint8Array(buf), { status: 200 });
  }) as typeof fetch;
  return () => {
    global.fetch = original;
  };
}

let restoreFetch: (() => void) | null = null;
afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

describe("deriveGalleryPhotoOrder", () => {
  it("空配列を渡すと空配列を返す", async () => {
    expect(await deriveGalleryPhotoOrder([])).toEqual([]);
  });

  it("ほぼ同一画像は1枚に畳まれる", async () => {
    const buf = await makeCheckerboard({});
    restoreFetch = stubFetchWithImages({
      "https://example.test/a.jpg": buf,
      "https://example.test/b.jpg": buf,
      "https://example.test/c.jpg": buf,
    });
    const result = await deriveGalleryPhotoOrder([
      "https://example.test/a.jpg",
      "https://example.test/b.jpg",
      "https://example.test/c.jpg",
    ]);
    expect(result).toHaveLength(1);
  });

  it("明確に異なる画像は畳まれずに残る", async () => {
    const a = await makeCheckerboard({});
    const b = await makeCheckerboard({ invert: true });
    restoreFetch = stubFetchWithImages({ "https://example.test/a.jpg": a, "https://example.test/b.jpg": b });
    const result = await deriveGalleryPhotoOrder(["https://example.test/a.jpg", "https://example.test/b.jpg"]);
    expect(result).toHaveLength(2);
  });

  it("結果に含まれるURLは入力に実在するものだけ(捏造しない)", async () => {
    const buf = await makeCheckerboard({});
    restoreFetch = stubFetchWithImages({ "https://example.test/a.jpg": buf });
    const input = ["https://example.test/a.jpg"];
    const result = await deriveGalleryPhotoOrder(input);
    expect(result.every((url) => input.includes(url))).toBe(true);
  });

  it("画像デコードに失敗しても例外を投げず結果を返す", async () => {
    const original = global.fetch;
    global.fetch = vi.fn(async () => new Response(new Uint8Array(Buffer.from("not-an-image")), { status: 200 })) as typeof fetch;
    restoreFetch = () => {
      global.fetch = original;
    };
    const result = await deriveGalleryPhotoOrder(["https://example.test/broken.jpg"]);
    expect(result).toEqual(["https://example.test/broken.jpg"]);
  });

  it("決定性: 同一入力を2回実行しても同一出力になる", async () => {
    const a = await makeCheckerboard({});
    const b = await makeCheckerboard({ invert: true });
    restoreFetch = stubFetchWithImages({ "https://example.test/a.jpg": a, "https://example.test/b.jpg": b });
    const input = ["https://example.test/a.jpg", "https://example.test/b.jpg"];
    const first = await deriveGalleryPhotoOrder(input);
    const second = await deriveGalleryPhotoOrder(input);
    expect(first).toEqual(second);
  });
});
