import { describe, it, expect } from "vitest";
import { buildOutreach, type OutreachInput } from "@/lib/outreach";

const store: OutreachInput["store"] = {
  name: "海風食堂",
  category: "restaurant",
  area: "那覇市",
  rating: 4.5,
  review_count: 200,
  has_website: false,
  instagram_url: "https://instagram.com/x",
  facebook_url: null,
};

describe("buildOutreach", () => {
  it("メールは件名と店名・エリアを含む", () => {
    const t = buildOutreach("email", { store });
    expect(t).toContain("件名:");
    expect(t).toContain("海風食堂");
    expect(t).toContain("那覇市");
  });

  it("Instagram DMはInstagram運用に触れつつ短め", () => {
    const t = buildOutreach("instagram_dm", { store });
    expect(t).toContain("Instagram");
    expect(t.length).toBeLessThan(500);
  });

  it("電話トークは名乗り・クロージング・切り返しを含む", () => {
    const t = buildOutreach("phone_script", { store, sales_angle: "予約導線の確立" });
    expect(t).toContain("名乗り");
    expect(t).toContain("クロージング");
    expect(t).toContain("切り返し");
    expect(t).toContain("予約導線の確立"); // 営業切り口を反映
  });

  it("実績データが無ければ数値を断定しない", () => {
    const t = buildOutreach("email", {
      store: { ...store, rating: null, review_count: 0 },
    });
    // 評価/口コミ件数の断定表現を含まない
    expect(t).not.toContain("評価4");
    expect(t).toContain("丁寧に営業");
  });

  it("HP有無で訴求が変わる", () => {
    const withHp = buildOutreach("instagram_dm", { store: { ...store, has_website: true } });
    const noHp = buildOutreach("instagram_dm", { store: { ...store, has_website: false } });
    expect(withHp).not.toBe(noHp);
  });
});
