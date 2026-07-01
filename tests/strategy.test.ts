import { describe, it, expect } from "vitest";
import { diagnoseStore } from "@/lib/neumos/strategy";
import { buildNeumosBrief } from "@/lib/neumos/neumos-brief";
import type { Store, Lead } from "@/lib/types";

const store: Store = {
  id: "store-1",
  tenant_id: null,
  place_id: "pid-1",
  name: "海風食堂",
  category: "restaurant",
  address: "沖縄県那覇市おもろまち1-2-3",
  phone: "098-000-0001",
  opening_hours: { weekday_text: ["月-金 11:00-22:00"] },
  rating: 4.5,
  review_count: 200,
  photo_count: 2,
  website_url: null,
  instagram_url: "https://instagram.com/x",
  facebook_url: null,
  has_website: false,
  area: "那覇市",
  source: "google_places",
  raw_payload: null,
  created_at: "2026-06-25T00:00:00.000Z",
  updated_at: "2026-06-25T00:00:00.000Z",
};

const lead: Lead = {
  id: "lead-1",
  store_id: "store-1",
  priority_rank: "A",
  score: 85,
  reasons: ["ホームページ未整備", "高評価", "口コミ多数"],
  sales_angle: "予約導線の確立",
  risk_flags: [],
  status: "todo",
  contact_method: null,
  last_contacted_at: null,
  notes: null,
  created_at: "x",
  updated_at: "x",
};

describe("diagnoseStore (Thinking Engine)", () => {
  it("店舗診断の全項目を返す", () => {
    const s = diagnoseStore({ store, lead });
    expect(s.storeId).toBe("store-1");
    expect(s.strengths.length).toBeGreaterThan(0);
    expect(s.weaknesses.length).toBeGreaterThan(0);
    expect(s.marketingProblems.length).toBeGreaterThan(0);
    expect(s.targetCustomer).toContain("那覇市");
    expect(s.recommendedOffer.length).toBeGreaterThan(0);
    expect(s.salesAngle).toBe("予約導線の確立"); // leadの営業切り口を反映
    expect(s.websiteConcept.length).toBeGreaterThan(0);
    expect(s.seoKeywords.length).toBeGreaterThan(0);
    expect(s.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(s.confidenceScore).toBeLessThanOrEqual(100);
    // 診断の追加項目
    expect(s.websiteNecessity.length).toBeGreaterThan(0);
    expect(s.snsImprovements.length).toBeGreaterThan(0);
    expect(s.googleBusinessImprovements.length).toBeGreaterThan(0);
    expect(s.differentiation.length).toBeGreaterThan(0);
    expect(s.recommendedPages).toContain("メニュー");
    expect(s.priorityRationale).toContain("優先度A");
    expect(s.method).toBe("rule");
  });

  it("HP無し・高評価・口コミ多・SNSありは受注確率が高い", () => {
    const s = diagnoseStore({ store, lead });
    expect(s.confidenceScore).toBeGreaterThanOrEqual(80);
  });

  it("generationBrief に受け渡し核が揃う", () => {
    const s = diagnoseStore({ store, lead });
    expect(s.generationBrief.storeName).toBe("海風食堂");
    expect(s.generationBrief.industry).toBe("飲食店");
    expect(s.generationBrief.area).toBe("那覇市");
    expect(s.generationBrief.mainProblem.length).toBeGreaterThan(0);
    expect(s.generationBrief.recommendedPages.length).toBeGreaterThan(0);
    expect(s.generationBrief.seoKeywords.length).toBeGreaterThan(0);
  });

  it("実データが無くても仮説明記で診断できる（捏造しない）", () => {
    const bare: Store = {
      ...store,
      rating: null,
      review_count: 0,
      photo_count: 0,
      instagram_url: null,
    };
    const s = diagnoseStore({ store: bare, lead: null });
    expect(s.strengths.join("")).toContain("仮説");
    expect(s.priorityRationale.length).toBeGreaterThan(0);
  });
});

describe("buildNeumosBrief", () => {
  it("StoreStrategy から NeumosBrief を生成し generationType を付与", () => {
    const s = diagnoseStore({ store, lead });
    const web = buildNeumosBrief(s, "website");
    expect(web.generationType).toBe("website");
    expect(web.storeName).toBe("海風食堂");
    expect(web.industry).toBe("飲食店");
    expect(web.websiteGoal.length).toBeGreaterThan(0);
    expect(web.tone.length).toBeGreaterThan(0);
    expect(web.offer.length).toBeGreaterThan(0);
  });

  it("同じ戦略から generationType だけ変えて別種別ブリーフを作れる", () => {
    const s = diagnoseStore({ store, lead });
    const web = buildNeumosBrief(s, "website");
    const blog = buildNeumosBrief(s, "blog_post");
    expect(blog.generationType).toBe("blog_post");
    // 共有コンテキストは不変
    expect(blog.storeName).toBe(web.storeName);
    expect(blog.seoKeywords).toEqual(web.seoKeywords);
    expect(blog.salesAngle).toBe(web.salesAngle);
  });
});
