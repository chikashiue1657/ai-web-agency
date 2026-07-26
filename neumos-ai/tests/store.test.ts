import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StoredGenerationRecord } from "@/lib/types";
import type { BrandPlan } from "@/lib/brand-director/types";

/**
 * store.ts がSupabase設定時にSupabaseへ読み書きすること（インメモリに閉じないこと）を検証する。
 * Vercelサーバーレスでは複数インスタンス・再起動をまたぐため、インメモリだけでは
 * /preview/[requestId] が失われる問題の修正を確認するテスト。
 */

const rows = new Map<string, Record<string, unknown>>();

function fakeSupabaseAdmin() {
  return {
    from(table: string) {
      if (table !== "neumos_content_generation_requests") throw new Error(`unexpected table: ${table}`);
      return {
        upsert(row: Record<string, unknown>, _opts: { onConflict: string }) {
          rows.set(row.request_id as string, row);
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq(_col: string, value: string) {
              return {
                maybeSingle: () => Promise.resolve({ data: rows.get(value) ?? null, error: null }),
              };
            },
            order() {
              const all = Array.from(rows.values()).sort((a, b) =>
                (b.created_at as string).localeCompare(a.created_at as string)
              );
              return Promise.resolve({ data: all, error: null });
            },
          };
        },
      };
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn(() => fakeSupabaseAdmin()),
  getSupabaseProjectRef: vi.fn(() => "test-project-ref"),
}));

const brief = {
  storeName: "Cafe Test",
  industry: "カフェ",
  area: "那覇市",
  targetCustomer: "地域客",
  mainProblem: "HP無し",
  salesAngle: "予約導線",
  websiteGoal: "予約獲得",
  siteConcept: "テスト用",
  recommendedPages: ["トップ"],
  seoKeywords: ["那覇市 カフェ"],
  tone: "温かみ",
  offer: "初回無料",
};

describe("store.ts（Supabase設定時）", () => {
  beforeEach(() => {
    rows.clear();
    vi.resetModules();
  });

  it("saveGenerationRecordで保存した内容をgetGenerationRecordで取得できる", async () => {
    const { saveGenerationRecord, getGenerationRecord } = await import("@/lib/store");
    const { generateWebsiteRuleBased } = await import("@/lib/engine/rule-based");
    const contents = generateWebsiteRuleBased(brief);

    const record: StoredGenerationRecord = {
      requestId: "req-supabase-1",
      generationType: "website",
      brief,
      status: "preview",
      method: "rule",
      generatedContents: contents,
      previewHtml: "<html>test</html>",
      previewUrl: "https://example.com/preview/req-supabase-1",
      publishedUrl: null,
      createdAt: new Date().toISOString(),
    };

    await saveGenerationRecord(record);
    // インメモリではなくfakeSupabaseAdmin側にも書き込まれていること
    expect(rows.has("req-supabase-1")).toBe(true);

    const fetched = await getGenerationRecord("req-supabase-1");
    expect(fetched?.requestId).toBe("req-supabase-1");
    expect(fetched?.previewHtml).toBe("<html>test</html>");
    expect(fetched?.generatedContents.heroTitle).toBe(contents.heroTitle);
  });

  it("brandPlanありのrecordはSupabase往復後も同じ内容で復元される", async () => {
    const { saveGenerationRecord, getGenerationRecord } = await import("@/lib/store");
    const { generateWebsiteRuleBased } = await import("@/lib/engine/rule-based");
    const contents = generateWebsiteRuleBased(brief);

    const brandPlan: BrandPlan = {
      brandArchetype: "artisan",
      industry: "cafe",
      audiences: ["地域客"],
      customerIntent: "HP無し",
      moodKeywords: ["温かみ", "予約導線", "初回無料"],
      valueProposition: "予約導線",
      visualDirection: { paletteHint: "neutral", typographyTone: "editorial-serif", photoTreatment: "framed" },
      copyDirection: { tone: "温かみ", emphasis: "atmosphere" },
      layoutVariant: "direct",
      photoAssignments: [],
      ctaStrategy: { placement: "hero", urgency: "low" },
      confidence: 0.4,
      evidence: [{ field: "industry", basis: "brief", detail: 'brief.industry="カフェ"' }],
    };

    const record: StoredGenerationRecord = {
      requestId: "req-supabase-brandplan-1",
      generationType: "website",
      brief,
      status: "preview",
      method: "rule",
      generatedContents: contents,
      previewHtml: "<html>test</html>",
      previewUrl: "https://example.com/preview/req-supabase-brandplan-1",
      publishedUrl: null,
      createdAt: new Date().toISOString(),
      brandPlan,
    };

    await saveGenerationRecord(record);
    const storedRow = rows.get("req-supabase-brandplan-1");
    expect(storedRow?.brand_plan).toEqual(brandPlan);

    const fetched = await getGenerationRecord("req-supabase-brandplan-1");
    expect(fetched?.brandPlan).toEqual(brandPlan);
  });

  it("brandPlan無しのrecordはbrand_plan:nullとして保存され、取得時はundefinedへ戻る", async () => {
    const { saveGenerationRecord, getGenerationRecord } = await import("@/lib/store");
    const { generateWebsiteRuleBased } = await import("@/lib/engine/rule-based");
    const contents = generateWebsiteRuleBased(brief);

    const record: StoredGenerationRecord = {
      requestId: "req-supabase-no-brandplan",
      generationType: "website",
      brief,
      status: "preview",
      method: "rule",
      generatedContents: contents,
      previewHtml: "<html>test</html>",
      previewUrl: "https://example.com/preview/req-supabase-no-brandplan",
      publishedUrl: null,
      createdAt: new Date().toISOString(),
      // brandPlanを意図的に付けない。
    };

    await saveGenerationRecord(record);
    expect(rows.get("req-supabase-no-brandplan")?.brand_plan).toBeNull();

    const fetched = await getGenerationRecord("req-supabase-no-brandplan");
    expect(fetched?.brandPlan).toBeUndefined();
  });

  it("legacy行（brand_plan列自体が存在しない）でもgetGenerationRecordはbrandPlan:undefinedで正常に返す", async () => {
    const { getGenerationRecord } = await import("@/lib/store");
    const { generateWebsiteRuleBased } = await import("@/lib/engine/rule-based");
    const contents = generateWebsiteRuleBased(brief);

    // brand_plan列が追加される前に作成された行を模す（キー自体が無い）。
    const legacyRow: Record<string, unknown> = {
      request_id: "req-legacy-no-column",
      generation_type: "website",
      brief,
      status: "preview",
      method: "rule",
      generated_contents: contents,
      preview_html: "<html>legacy</html>",
      preview_url: "https://example.com/preview/req-legacy-no-column",
      published_url: null,
      created_at: new Date().toISOString(),
    };
    rows.set("req-legacy-no-column", legacyRow);

    const fetched = await getGenerationRecord("req-legacy-no-column");
    expect(fetched?.requestId).toBe("req-legacy-no-column");
    expect(fetched?.brandPlan).toBeUndefined();
  });

  it("存在しないrequestIdはundefinedを返す", async () => {
    const { getGenerationRecord } = await import("@/lib/store");
    const fetched = await getGenerationRecord("does-not-exist");
    expect(fetched).toBeUndefined();
  });

  it("listGenerationRecordsはSupabase経由で全件を新しい順に返す", async () => {
    const { saveGenerationRecord, listGenerationRecords } = await import("@/lib/store");
    const { generateWebsiteRuleBased } = await import("@/lib/engine/rule-based");
    const contents = generateWebsiteRuleBased(brief);

    const base: Omit<StoredGenerationRecord, "requestId" | "createdAt"> = {
      generationType: "website",
      brief,
      status: "preview",
      method: "rule",
      generatedContents: contents,
      previewHtml: "<html></html>",
      previewUrl: "https://example.com/preview/x",
      publishedUrl: null,
    };

    await saveGenerationRecord({ ...base, requestId: "req-a", createdAt: "2026-01-01T00:00:00.000Z" });
    await saveGenerationRecord({ ...base, requestId: "req-b", createdAt: "2026-01-02T00:00:00.000Z" });

    const all = await listGenerationRecords();
    expect(all.map((r) => r.requestId)).toEqual(["req-b", "req-a"]);
  });
});
