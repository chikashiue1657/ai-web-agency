import { describe, it, expect } from "vitest";
import { buildSiteGenerationBrief, BRIEF_SCHEMA_VERSION } from "@/lib/neumos/brief";
import type { Store, Lead, Proposal } from "@/lib/types";

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
  raw_payload: { photos: [{ name: "places/AAA/photos/BBB" }] },
  created_at: "2026-06-25T00:00:00.000Z",
  updated_at: "2026-06-25T00:00:00.000Z",
};

const lead: Lead = {
  id: "lead-1",
  store_id: "store-1",
  priority_rank: "A",
  score: 85,
  reasons: ["ホームページ未整備"],
  sales_angle: "予約導線の確立",
  risk_flags: [],
  status: "won",
  contact_method: "phone",
  last_contacted_at: null,
  notes: null,
  created_at: "x",
  updated_at: "x",
};

const proposal: Proposal = {
  id: "prop-1",
  store_id: "store-1",
  summary: "要約",
  problems: ["HP無しで機会損失"],
  opportunities: ["高評価で集客力あり"],
  suggested_sections: ["TOP", "メニュー", "アクセス"],
  sales_message: "メッセージ",
  generated_markdown: "# 提案書",
  created_at: "x",
};

describe("buildSiteGenerationBrief", () => {
  it("店舗・優先度・提案書を1つの契約に集約する", () => {
    const brief = buildSiteGenerationBrief({ store, lead, proposal });
    expect(brief.schemaVersion).toBe(BRIEF_SCHEMA_VERSION);
    expect(brief.store.name).toBe("海風食堂");
    expect(brief.store.categoryLabel).toBe("飲食店");
    expect(brief.online.hasWebsite).toBe(false);
    expect(brief.priority).toEqual({ rank: "A", score: 85 });
    expect(brief.salesAngle).toBe("予約導線の確立");
    // 提案書の素材が渡される
    expect(brief.strengths).toContain("高評価で集客力あり");
    expect(brief.improvements).toContain("HP無しで機会損失");
    expect(brief.suggestedSections).toContain("メニュー");
    expect(brief.sourceProposalMarkdown).toContain("# 提案書");
    // 写真参照が抽出される
    expect(brief.metrics.photoRefs).toContain("places/AAA/photos/BBB");
    // テーマ・SEOのヒント
    expect(brief.theme.suggestedType.length).toBeGreaterThan(0);
    expect(brief.seo.titleHint).toContain("海風食堂");
  });

  it("提案書が無くても実データから最小限のブリーフを作る", () => {
    const brief = buildSiteGenerationBrief({ store, lead: null, proposal: null });
    expect(brief.priority).toBeNull();
    expect(brief.strengths.length).toBeGreaterThan(0);
    expect(brief.improvements.length).toBeGreaterThan(0);
    // 仮説・要確認が明示される（捏造しない）
    expect(brief.assumptions.length).toBeGreaterThan(0);
    expect(brief.sourceProposalMarkdown).toBeNull();
  });

  it("写真が少ない場合は仮説（フォールバック前提）を含める", () => {
    const brief = buildSiteGenerationBrief({ store, lead: null, proposal: null });
    expect(brief.assumptions.join("")).toContain("写真");
  });
});
