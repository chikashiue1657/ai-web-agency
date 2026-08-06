import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Jimp, rgbaToInt } from "jimp";
import { IMAGE_HASH_DISTANCE_THRESHOLD, TEXT_JACCARD_THRESHOLD, compressArtifacts } from "@/lib/editorial/compress";
import { isImageArtifact, isTextArtifact, type Artifact, type ImageArtifact, type TextArtifact } from "@/lib/editorial/artifact";

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

/** テスト用: URLごとに返すPNGバッファをマップで持ち、fetchをモックする。 */
function stubFetchWithImages(buffersByUrl: Record<string, Buffer | null>) {
  const original = global.fetch;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const buf = buffersByUrl[url];
    if (buf === undefined) throw new Error(`unexpected fetch: ${url}`);
    if (buf === null) {
      return new Response(new Uint8Array(Buffer.from("not-an-image")), { status: 200 });
    }
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

function image(id: string, sourceOrder: number, url: string): ImageArtifact {
  return { id, media: "image", sourceOrder, url, absorbedCount: 0 };
}

function text(id: string, sourceOrder: number, t: string): TextArtifact {
  return { id, media: "text", sourceOrder, text: t, charCount: t.length, absorbedCount: 0 };
}

describe("compressArtifacts", () => {
  it("完全同一画像は1件に畳まれ、absorbedCountに反映される", async () => {
    const buf = await makeCheckerboard({});
    restoreFetch = stubFetchWithImages({
      "https://example.test/a.jpg": buf,
      "https://example.test/b.jpg": buf,
      "https://example.test/c.jpg": buf,
    });
    const input: Artifact[] = [
      image("i0", 0, "https://example.test/a.jpg"),
      image("i1", 1, "https://example.test/b.jpg"),
      image("i2", 2, "https://example.test/c.jpg"),
    ];
    const { artifacts } = await compressArtifacts(input);
    const images = artifacts.filter(isImageArtifact);
    expect(images).toHaveLength(1);
    expect(images[0].id).toBe("i0"); // sourceOrder最小が代表
    expect(images[0].absorbedCount).toBe(2);
  });

  it("構図が明確に異なる画像は畳まれず残る", async () => {
    const a = await makeCheckerboard({});
    const b = await makeCheckerboard({ invert: true });
    restoreFetch = stubFetchWithImages({ "https://example.test/a.jpg": a, "https://example.test/b.jpg": b });
    const input: Artifact[] = [image("i0", 0, "https://example.test/a.jpg"), image("i1", 1, "https://example.test/b.jpg")];
    const { artifacts } = await compressArtifacts(input);
    expect(artifacts.filter(isImageArtifact)).toHaveLength(2);
    expect(artifacts.every((a) => a.absorbedCount === 0)).toBe(true);
  });

  it("軽微なリサイズ・軽微な圧縮差・色味だけ異なる画像は畳まれる", async () => {
    const original = await makeCheckerboard({ size: 60, square: 10 });
    const resized = await makeCheckerboard({ size: 54, square: 9 });
    restoreFetch = stubFetchWithImages({
      "https://example.test/original.jpg": original,
      "https://example.test/resized.jpg": resized,
    });
    const input: Artifact[] = [
      image("i0", 0, "https://example.test/original.jpg"),
      image("i1", 1, "https://example.test/resized.jpg"),
    ];
    const { artifacts } = await compressArtifacts(input);
    expect(artifacts.filter(isImageArtifact)).toHaveLength(1);
  });

  it("画像デコードに失敗しても例外を投げず、そのまま独立した1件として残す(absorbedCount=0)", async () => {
    restoreFetch = stubFetchWithImages({ "https://example.test/broken.jpg": null });
    const input: Artifact[] = [image("i0", 0, "https://example.test/broken.jpg")];
    const { artifacts } = await compressArtifacts(input);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].absorbedCount).toBe(0);
  });

  it("完全同一テキストは1件に畳まれる", async () => {
    const input: Artifact[] = [
      text("t0", 0, "自家焙煎の深煎りブレンドです。"),
      text("t1", 1, "自家焙煎の深煎りブレンドです。"),
    ];
    const { artifacts } = await compressArtifacts(input);
    const texts = artifacts.filter(isTextArtifact);
    expect(texts).toHaveLength(1);
    expect(texts[0].absorbedCount).toBe(1);
  });

  it("空白・句読点だけ異なるテキストも畳まれる", async () => {
    const input: Artifact[] = [
      text("t0", 0, "自家焙煎の深煎りブレンドです。香り高い一杯。"),
      text("t1", 1, "自家焙煎の深煎りブレンドです 香り高い一杯"),
    ];
    const { artifacts } = await compressArtifacts(input);
    expect(artifacts.filter(isTextArtifact)).toHaveLength(1);
  });

  it("似ているが意味の異なるテキストは誤って畳まれない", async () => {
    const input: Artifact[] = [
      text("t0", 0, "自家焙煎の深煎りブレンドは、しっかりとした苦味とコクが特徴です。"),
      text("t1", 1, "自家焙煎の浅煎りブレンドは、フルーティーな酸味が特徴です。"),
    ];
    const { artifacts } = await compressArtifacts(input);
    expect(artifacts.filter(isTextArtifact)).toHaveLength(2);
  });

  it("元データ(text/url)を書き換えない", async () => {
    const buf = await makeCheckerboard({});
    restoreFetch = stubFetchWithImages({ "https://example.test/a.jpg": buf, "https://example.test/b.jpg": buf });
    const input: Artifact[] = [
      image("i0", 0, "https://example.test/a.jpg"),
      image("i1", 1, "https://example.test/b.jpg"),
      text("t0", 2, "元のテキスト"),
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    await compressArtifacts(input);
    expect(input).toEqual(snapshot);
  });

  it("決定性: 同一入力を2回実行しても同一出力になる", async () => {
    const buf = await makeCheckerboard({});
    const other = await makeCheckerboard({ invert: true });
    restoreFetch = stubFetchWithImages({ "https://example.test/a.jpg": buf, "https://example.test/b.jpg": other });
    const input: Artifact[] = [
      image("i0", 0, "https://example.test/a.jpg"),
      image("i1", 1, "https://example.test/b.jpg"),
      text("t0", 2, "テキストA"),
    ];
    const first = await compressArtifacts(input);
    const second = await compressArtifacts(input);
    expect(first).toEqual(second);
  });

  it("空配列を渡してもクラッシュしない", async () => {
    const { artifacts } = await compressArtifacts([]);
    expect(artifacts).toEqual([]);
  });

  it("500件相当のテキスト入力でも許容範囲の時間で完了する", async () => {
    const input: Artifact[] = Array.from({ length: 500 }, (_, i) => text(`t${i}`, i, `テキスト本文その${i}番目です。`));
    const start = Date.now();
    const { artifacts } = await compressArtifacts(input);
    const elapsedMs = Date.now() - start;
    expect(artifacts.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(5000);
  });

  it("しきい値定数がエクスポートされている(テスト・調整用)", () => {
    expect(IMAGE_HASH_DISTANCE_THRESHOLD).toBeGreaterThan(0);
    expect(TEXT_JACCARD_THRESHOLD).toBeGreaterThan(0.5);
  });
});
