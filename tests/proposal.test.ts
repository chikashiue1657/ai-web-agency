import { describe, it, expect } from "vitest";
import { buildProposal } from "@/lib/proposal";

const baseStore = {
  name: "海風食堂",
  category: "restaurant",
  area: "那覇市",
  address: "沖縄県那覇市1-1",
  rating: 4.5,
  review_count: 200,
  photo_count: 2,
  has_website: false,
  instagram_url: "https://instagram.com/x",
  facebook_url: null,
};

describe("buildProposal", () => {
  it("Markdownと構造化フィールドを生成する", () => {
    const p = buildProposal({ store: baseStore });
    expect(p.generated_markdown).toContain("# 海風食堂 様 ご提案書");
    expect(p.suggested_sections).toContain("メニュー");
    expect(p.problems.length).toBeGreaterThan(0);
    expect(p.opportunities.length).toBeGreaterThan(0);
    expect(p.sales_message.length).toBeGreaterThan(0);
    expect(p.summary.length).toBeGreaterThan(0);
  });

  it("HP無しの機会損失が含まれる", () => {
    const p = buildProposal({ store: baseStore });
    expect(p.problems.join("")).toContain("ホームページ");
  });

  it("不明情報は仮説として明記する（捏造しない）", () => {
    const p = buildProposal({
      store: { ...baseStore, address: null, rating: null, review_count: 0 },
    });
    // 口コミ要約未提供時は仮説表記
    expect(p.generated_markdown).toContain("（仮説）");
    // 住所不明は要確認表記
    expect(p.generated_markdown).toContain("要確認");
  });

  it("業種差分: 医療は診療案内系の構成になる", () => {
    const p = buildProposal({
      store: { ...baseStore, name: "ちゅらクリニック", category: "clinic" },
    });
    expect(p.suggested_sections.join("")).toContain("診療");
  });
});
