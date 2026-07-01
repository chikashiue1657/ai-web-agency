import { describe, it, expect } from "vitest";
import { normalizePlacesNew } from "@/lib/normalize";
import { getMemoryRepository } from "@/lib/repo/memory";
import { scoreStore } from "@/lib/services";

/**
 * Places取得後の保存パイプラインの検証。
 * - Repository層は Supabase/インメモリ共通インターフェース。ここではインメモリで
 *   「保存 → place_id重複チェック → 優先度/スコア/ステータス付与」を確認する。
 * - scoreStore は getRepo()（テストではインメモリ）を使うため同一インスタンスを共有。
 */
const samplePlace = {
  id: "test_place_dedup_1",
  displayName: { text: "テスト海カフェ" },
  primaryType: "cafe",
  types: ["cafe", "food"],
  formattedAddress: "沖縄県沖縄市中央1-1-1",
  nationalPhoneNumber: "098-999-0001",
  rating: 4.6,
  userRatingCount: 180,
  photos: [{ name: "p1" }, { name: "p2" }],
  regularOpeningHours: { weekdayDescriptions: ["月曜日: 9時00分～18時00分"] },
};

describe("Places取得 → 保存 → 重複チェック → 優先度判定", () => {
  it("初回保存は inserted、同一place_idの再保存は updated（重複を作らない）", async () => {
    const repo = getMemoryRepository();
    const n = normalizePlacesNew(samplePlace);

    const first = await repo.upsertStores([n]);
    expect(first.inserted).toBe(1);
    expect(first.updated).toBe(0);
    const storeId = first.stores[0].id;

    // 同じplace_idをもう一度 → 新規は作らず既存を更新
    const again = await repo.upsertStores([normalizePlacesNew(samplePlace)]);
    expect(again.inserted).toBe(0);
    expect(again.updated).toBe(1);
    expect(again.stores[0].id).toBe(storeId); // 同一レコード
  });

  it("保存した店舗に優先度A/B/C・スコア・ステータスが付与される", async () => {
    const repo = getMemoryRepository();
    const n = normalizePlacesNew({ ...samplePlace, id: "test_place_score_1" });
    const { stores } = await repo.upsertStores([n]);
    const storeId = stores[0].id;

    const { lead, result } = await scoreStore(storeId, { useLlm: false });
    expect(["A", "B", "C"]).toContain(lead.priority_rank);
    expect(typeof lead.score).toBe("number");
    expect(lead.score! >= 0 && lead.score! <= 100).toBe(true);
    expect(lead.status).toBe("new"); // 初期ステータス
    expect(result.reasons.length).toBeGreaterThan(0); // 説明可能
  });

  it("再判定してもステータス・メモは保持される（scoreはleadをupsert）", async () => {
    const repo = getMemoryRepository();
    const n = normalizePlacesNew({ ...samplePlace, id: "test_place_score_2" });
    const { stores } = await repo.upsertStores([n]);
    const storeId = stores[0].id;

    await scoreStore(storeId, { useLlm: false });
    await repo.updateLeadStatus(storeId, "contacted", "phone");
    await repo.updateLeadNotes(storeId, "初回接触済み");

    // 再判定
    const { lead } = await scoreStore(storeId, { useLlm: false });
    expect(lead.status).toBe("contacted"); // ステータス保持
    expect(lead.notes).toBe("初回接触済み"); // メモ保持
  });
});
