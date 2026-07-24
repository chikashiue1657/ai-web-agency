import { describe, expect, it } from "vitest";
import { classifyIndustry } from "@/lib/engine/industry";

describe("classifyIndustry", () => {
  it.each([
    ["カフェ", "cafe"],
    ["コーヒーショップ", "cafe"],
    ["美容室", "hair_salon"],
    ["ヘアサロン", "hair_salon"],
    ["整体院", "spa"],
    ["整骨院", "spa"],
    ["エステサロン", "spa"],
    ["居酒屋", "izakaya"],
    ["ホテル", "hotel"],
    ["旅館", "hotel"],
    ["ジム", "general"],
    ["工務店", "general"],
  ] as const)("%s は %s に分類される", (industry, expected) => {
    expect(classifyIndustry(industry)).toBe(expected);
  });
});
