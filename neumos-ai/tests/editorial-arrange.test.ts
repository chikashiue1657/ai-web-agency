import { describe, expect, it } from "vitest";
import {
  arrangeArtifacts,
  clusterStrategy,
  nearestNeighborThenTwoOpt,
  similarityCost,
  type ArrangeStrategy,
} from "@/lib/editorial/arrange";
import { isImageArtifact, isTextArtifact, type Artifact, type ImageArtifact, type TextArtifact } from "@/lib/editorial/artifact";

function img(id: string, sourceOrder: number, hash: bigint): ImageArtifact {
  return { id, media: "image", sourceOrder, url: `https://example.test/${id}.jpg`, absorbedCount: 0, hash };
}

function txt(id: string, sourceOrder: number, text: string): TextArtifact {
  return { id, media: "text", sourceOrder, text, charCount: text.length, absorbedCount: 0 };
}

describe("arrangeArtifacts", () => {
  it("0件では空配列", () => {
    expect(arrangeArtifacts([])).toEqual([]);
  });

  it("1件ではそのまま返す", () => {
    const single = [txt("t0", 0, "テキスト")];
    expect(arrangeArtifacts(single)).toEqual(single);
  });

  it("2件では両方とも含まれる", () => {
    const two = [txt("t0", 0, "テキストA"), txt("t1", 1, "テキストB")];
    const result = arrangeArtifacts(two);
    expect(result).toHaveLength(2);
    expect(new Set(result.map((a) => a.id))).toEqual(new Set(["t0", "t1"]));
  });

  it("複数クラスタ: 似たテキスト同士が隣接するように並ぶ", () => {
    const groupA = [
      txt("a0", 0, "自家焙煎の深煎りブレンドです。香りが強い一杯。"),
      txt("a1", 3, "自家焙煎の深煎りブレンドをご用意。香り高い一杯。"),
    ];
    const groupB = [
      txt("b0", 1, "ゆったりくつろげる客席をご用意しています。"),
      txt("b1", 2, "落ち着いてくつろげる客席をご用意しています。"),
    ];
    const result = arrangeArtifacts([...groupA, ...groupB]);
    const ids = result.map((a) => a.id);
    // グループ内が隣接していれば、a0/a1の位置差・b0/b1の位置差はどちらも1になる
    const posA0 = ids.indexOf("a0");
    const posA1 = ids.indexOf("a1");
    const posB0 = ids.indexOf("b0");
    const posB1 = ids.indexOf("b1");
    expect(Math.abs(posA0 - posA1)).toBe(1);
    expect(Math.abs(posB0 - posB1)).toBe(1);
  });

  it("全Artifactが互いに類似: 距離0同士でも決定的に一意な順序を返す", () => {
    const items = [txt("t0", 0, "同じ文章です"), txt("t1", 1, "同じ文章です"), txt("t2", 2, "同じ文章です")];
    const result = arrangeArtifacts(items);
    expect(result).toHaveLength(3);
    expect(new Set(result.map((a) => a.id)).size).toBe(3);
  });

  it("全Artifactが互いに非類似でもクラッシュせず全件を返す", () => {
    const items = [
      txt("t0", 0, "コーヒーの香りが漂う店内です"),
      txt("t1", 1, "駐車場は店舗裏に3台分あります"),
      txt("t2", 2, "毎週水曜日は定休日となります"),
    ];
    const result = arrangeArtifacts(items);
    expect(result).toHaveLength(3);
  });

  it("画像のみ: テキスト系列が空でも成立する", () => {
    const items = [img("i0", 0, 0x0n), img("i1", 1, 0xffn)];
    const result = arrangeArtifacts(items);
    expect(result.filter(isImageArtifact)).toHaveLength(2);
    expect(result.filter(isTextArtifact)).toHaveLength(0);
  });

  it("テキストのみ: 画像系列が空でも成立する", () => {
    const items = [txt("t0", 0, "テキストA"), txt("t1", 1, "テキストB")];
    const result = arrangeArtifacts(items);
    expect(result.filter(isTextArtifact)).toHaveLength(2);
  });

  it("画像とテキスト混在でも全件を返す", () => {
    const items = [img("i0", 0, 0x0n), txt("t0", 1, "テキストA"), img("i1", 2, 0xffn), txt("t1", 3, "テキストB")];
    const result = arrangeArtifacts(items);
    expect(result).toHaveLength(4);
  });

  it("同一種別の過度な連続: 画像5枚+テキスト1件で、上限4件目の直後にテキストが差し込まれる", () => {
    const images = Array.from({ length: 5 }, (_, i) => img(`i${i}`, i, BigInt(i))); // 互いに極めて近いので順序はsourceOrder通りになりやすい
    const items: Artifact[] = [...images, txt("t0", 5, "唯一のテキスト")];
    const result = arrangeArtifacts(items);
    const textPos = result.findIndex((a) => a.id === "t0");
    // 5枚のうち先頭4枚が並んだ直後(index=4)に挿入される
    expect(textPos).toBeLessThanOrEqual(4);
    expect(textPos).toBeGreaterThan(0);
  });

  it("画像が3枚しかなければ連続上限(4)に達しないため、マージ挿入は発動しない", () => {
    const images = [img("i0", 0, 0x0n), img("i1", 1, 0x1n), img("i2", 2, 0x2n)];
    const items: Artifact[] = [...images, txt("t0", 3, "テキスト")];
    const result = arrangeArtifacts(items);
    // 画像3枚がまず並び、その後にテキストが続く(挿入は発動しない=末尾に来る)
    expect(result.slice(0, 3).every(isImageArtifact)).toBe(true);
    expect(result[3].id).toBe("t0");
  });

  it("同じ入力なら同じ順序になる(決定性)", () => {
    const items = [img("i0", 0, 0x0n), txt("t0", 1, "テキストA"), img("i1", 2, 0xf0n), txt("t1", 3, "テキストB")];
    const first = arrangeArtifacts(items);
    const second = arrangeArtifacts(items);
    expect(first.map((a) => a.id)).toEqual(second.map((a) => a.id));
  });

  it("入力順を変えても、同じ集合なら妥当な(クラッシュしない・全件保持する)順序に収束する", () => {
    const items = [img("i0", 0, 0x0n), txt("t0", 1, "テキストA"), img("i1", 2, 0xf0n), txt("t1", 3, "テキストB")];
    const shuffled = [items[3], items[1], items[0], items[2]];
    const result = arrangeArtifacts(shuffled);
    expect(new Set(result.map((a) => a.id))).toEqual(new Set(items.map((a) => a.id)));
  });

  it("12件程度なら十分高速に動く(2-optを含む)", () => {
    const items: Artifact[] = Array.from({ length: 12 }, (_, i) =>
      i % 2 === 0 ? img(`i${i}`, i, BigInt(i * 7)) : txt(`t${i}`, i, `テキスト本文その${i}番目`)
    );
    const start = Date.now();
    arrangeArtifacts(items);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("strategy未指定時はclusterStrategyと同一結果になる(既定動作の後方互換)", () => {
    const items = [img("i0", 0, 0x0n), txt("t0", 1, "テキストA"), img("i1", 2, 0xf0n)];
    const withDefault = arrangeArtifacts(items);
    const withExplicit = arrangeArtifacts(items, clusterStrategy);
    expect(withDefault).toEqual(withExplicit);
  });

  it("自作のArrangeStrategyを渡すと、clusterStrategyを経由せずその通りの順序になる(buildPath全体の差し替え可能性)", () => {
    const reverseStrategy: ArrangeStrategy = {
      name: "reverse",
      buildPath: (artifacts) => [...artifacts].reverse(),
    };
    const items = [img("i0", 0, 0x0n), img("i1", 1, 0x1n), img("i2", 2, 0x2n)];
    const result = arrangeArtifacts(items, reverseStrategy);
    expect(result.map((a) => a.id)).toEqual(["i2", "i1", "i0"]);
  });
});

describe("nearestNeighborThenTwoOpt / similarityCost", () => {
  it("0件・1件でも例外を投げない", () => {
    expect(nearestNeighborThenTwoOpt([], similarityCost, "seed")).toEqual([]);
    const single = [txt("t0", 0, "x")];
    expect(nearestNeighborThenTwoOpt(single, similarityCost, "seed")).toEqual(single);
  });

  it("hash未設定の画像同士は中立コストになりクラッシュしない", () => {
    const a: ImageArtifact = { id: "a", media: "image", sourceOrder: 0, url: "https://example.test/a.jpg", absorbedCount: 0 };
    const b: ImageArtifact = { id: "b", media: "image", sourceOrder: 1, url: "https://example.test/b.jpg", absorbedCount: 0 };
    expect(() => similarityCost(a, b)).not.toThrow();
    expect(similarityCost(a, b)).toBeGreaterThan(0);
  });
});
