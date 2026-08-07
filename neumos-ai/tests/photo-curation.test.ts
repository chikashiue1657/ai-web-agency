import { afterEach, describe, expect, it, vi } from "vitest";
import { Jimp, rgbaToInt } from "jimp";
import {
  DEFAULT_MAX_DISPLAY_PHOTOS,
  canonicalizePhotoUrl,
  compressPhotoUrls,
  dedupePhotoUrls,
  orderGalleryPhotos,
  selectDisplayPhotos,
} from "@/lib/engine/photo-curation";

function urls(count: number, prefix = "https://example.test/photo"): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}.svg`);
}

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

describe("canonicalizePhotoUrl", () => {
  it("クエリ文字列・フラグメントを取り除く", () => {
    expect(canonicalizePhotoUrl("https://example.test/a.svg?v=1")).toBe(
      "https://example.test/a.svg"
    );
    expect(canonicalizePhotoUrl("https://example.test/a.svg?v=2#frag")).toBe(
      "https://example.test/a.svg"
    );
  });

  it("不正なURL文字列でも例外を投げずフォールバックする", () => {
    expect(() => canonicalizePhotoUrl("not-a-valid-url")).not.toThrow();
    expect(canonicalizePhotoUrl("not-a-valid-url?x=1")).toBe("not-a-valid-url");
  });
});

describe("dedupePhotoUrls", () => {
  it("完全重複URLを1件に集約する", () => {
    const input = ["https://example.test/a.svg", "https://example.test/a.svg", "https://example.test/a.svg"];
    expect(dedupePhotoUrls(input)).toEqual(["https://example.test/a.svg"]);
  });

  it("クエリ文字列だけが異なるURLも実質同一として重複排除する", () => {
    const input = [
      "https://example.test/a.svg?v=1",
      "https://example.test/a.svg?v=2",
      "https://example.test/b.svg",
    ];
    expect(dedupePhotoUrls(input)).toEqual(["https://example.test/a.svg?v=1", "https://example.test/b.svg"]);
  });

  it("出現順を維持する", () => {
    const input = ["https://example.test/c.svg", "https://example.test/a.svg", "https://example.test/b.svg"];
    expect(dedupePhotoUrls(input)).toEqual(input);
  });

  it("元配列を変更しない", () => {
    const input = ["https://example.test/a.svg?v=1", "https://example.test/a.svg?v=2"];
    const snapshot = [...input];
    dedupePhotoUrls(input);
    expect(input).toEqual(snapshot);
  });
});

describe("selectDisplayPhotos", () => {
  it("0枚の場合は空配列を返す", () => {
    const result = selectDisplayPhotos([]);
    expect(result.selected).toEqual([]);
    expect(result.totalInput).toBe(0);
    expect(result.totalAfterDedup).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("undefinedの場合も空配列を返す", () => {
    const result = selectDisplayPhotos(undefined);
    expect(result.selected).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("1枚の場合はそのまま1枚を返す", () => {
    const result = selectDisplayPhotos(urls(1));
    expect(result.selected).toEqual(urls(1));
    expect(result.truncated).toBe(false);
  });

  it("12枚(既定上限)ちょうどの場合は全件返し、切り捨てフラグは立たない", () => {
    const input = urls(DEFAULT_MAX_DISPLAY_PHOTOS);
    const result = selectDisplayPhotos(input);
    expect(result.selected).toHaveLength(DEFAULT_MAX_DISPLAY_PHOTOS);
    expect(result.selected).toEqual(input);
    expect(result.truncated).toBe(false);
  });

  it("13枚の場合は12枚に切り詰め、truncated=trueになる", () => {
    const input = urls(13);
    const result = selectDisplayPhotos(input);
    expect(result.selected).toHaveLength(12);
    expect(result.totalAfterDedup).toBe(13);
    expect(result.truncated).toBe(true);
  });

  it("500枚の場合も最大12枚を超えない", () => {
    const input = urls(500);
    const result = selectDisplayPhotos(input);
    expect(result.selected.length).toBeLessThanOrEqual(DEFAULT_MAX_DISPLAY_PHOTOS);
    expect(result.selected).toHaveLength(12);
    expect(result.truncated).toBe(true);
    expect(result.totalInput).toBe(500);
  });

  it("均等サンプリングで最初と最後の写真を含む", () => {
    const input = urls(500);
    const result = selectDisplayPhotos(input);
    expect(result.selected[0]).toBe(input[0]);
    expect(result.selected[result.selected.length - 1]).toBe(input[input.length - 1]);
  });

  it("均等サンプリングは選抜後も元の出現順を維持する(昇順)", () => {
    const input = urls(500);
    const result = selectDisplayPhotos(input);
    const indices = result.selected.map((u) => input.indexOf(u));
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
    // 重複選択が無いことも合わせて確認する。
    expect(new Set(indices).size).toBe(indices.length);
  });

  it("クエリ文字列違いの実質同一画像が上限を圧迫しない(重複排除が先に効く)", () => {
    const sameImageDifferentQuery = Array.from({ length: 20 }, (_, i) => `https://example.test/only-one.svg?v=${i}`);
    const result = selectDisplayPhotos(sameImageDifferentQuery);
    expect(result.selected).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });

  it("元配列を変更しない", () => {
    const input = urls(30);
    const snapshot = [...input];
    selectDisplayPhotos(input);
    expect(input).toEqual(snapshot);
  });

  it("maxを明示的に指定できる", () => {
    const input = urls(20);
    const result = selectDisplayPhotos(input, 5);
    expect(result.selected).toHaveLength(5);
    expect(result.maxAllowed).toBe(5);
  });
});

describe("compressPhotoUrls", () => {
  it("空配列・undefinedでは空配列を返す", async () => {
    expect(await compressPhotoUrls([])).toEqual([]);
    expect(await compressPhotoUrls(undefined)).toEqual([]);
  });

  it("ほぼ同一画像(Hero候補とGallery候補が視覚的に重複する状況を想定)は1枚に畳まれる", async () => {
    const buf = await makeCheckerboard({});
    restoreFetch = stubFetchWithImages({
      "https://example.test/a.jpg": buf,
      "https://example.test/b.jpg": buf,
      "https://example.test/c.jpg": buf,
    });
    const result = await compressPhotoUrls(["https://example.test/a.jpg", "https://example.test/b.jpg", "https://example.test/c.jpg"]);
    expect(result).toHaveLength(1);
  });

  it("明確に異なる画像は畳まれずに残る", async () => {
    const a = await makeCheckerboard({});
    const b = await makeCheckerboard({ invert: true });
    restoreFetch = stubFetchWithImages({ "https://example.test/a.jpg": a, "https://example.test/b.jpg": b });
    const result = await compressPhotoUrls(["https://example.test/a.jpg", "https://example.test/b.jpg"]);
    expect(result).toHaveLength(2);
  });

  it("URL文字列レベルの重複排除+12枚上限を先に適用する(デコード対象を有界に保つ)", async () => {
    const buf = await makeCheckerboard({});
    const many = Array.from({ length: 30 }, (_, i) => `https://example.test/only-one.jpg?v=${i}`);
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(buf), { status: 200 }));
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    restoreFetch = () => {
      global.fetch = original;
    };
    await compressPhotoUrls(many);
    // 同一画像のクエリ違いはselectDisplayPhotos段階で1件に減るため、fetchは高々1回。
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("画像デコードに失敗しても例外を投げない", async () => {
    const original = global.fetch;
    global.fetch = vi.fn(async () => new Response(new Uint8Array(Buffer.from("not-an-image")), { status: 200 })) as typeof fetch;
    restoreFetch = () => {
      global.fetch = original;
    };
    const result = await compressPhotoUrls(["https://example.test/broken.jpg"]);
    expect(result).toEqual(["https://example.test/broken.jpg"]);
  });
});

describe("orderGalleryPhotos", () => {
  it("空配列では空配列を返す", async () => {
    expect(await orderGalleryPhotos([])).toEqual([]);
  });

  it("結果に含まれるURLは入力に実在するものだけ(捏造しない)", async () => {
    const input = ["https://example.test/a.jpg", "https://example.test/b.jpg"];
    const result = await orderGalleryPhotos(input);
    expect(result.every((url) => input.includes(url))).toBe(true);
    expect(new Set(result)).toEqual(new Set(input));
  });

  it("決定性: 同一入力を2回実行しても同一出力になる", async () => {
    const input = ["https://example.test/a.jpg", "https://example.test/b.jpg", "https://example.test/c.jpg"];
    const first = await orderGalleryPhotos(input);
    const second = await orderGalleryPhotos(input);
    expect(first).toEqual(second);
  });
});
