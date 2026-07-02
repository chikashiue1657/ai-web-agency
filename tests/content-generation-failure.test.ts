import { describe, it, expect, afterEach } from "vitest";
import { requestContentGeneration } from "@/lib/services";
import { getRepo } from "@/lib/repo";
import { ContentGenerationError } from "@/lib/neumos/client";

/**
 * Neumos APIへの通信より前段（AI診断・DB保存）で発生した「生の」例外も、
 * ContentGenerationError(.detail に NeumosErrorDetail) として一様に扱われることを検証する。
 * これにより actions.ts / neumos-panel.tsx は「コンテンツ生成依頼に失敗しました」のような
 * 詳細の無い文言だけを表示することがなくなる。
 */
const STORE_ID = "11111111-1111-1111-1111-111111111111";

describe("Neumos呼び出し前の失敗もNeumosErrorDetail付きで報告される", () => {
  afterEach(() => {
    delete process.env.NEUMOS_API_URL;
    delete process.env.NEUMOS_API_KEY;
  });

  it("AI診断(getStoreDetail)が生の例外を投げても ContentGenerationError.detail に情報が残る", async () => {
    const repo = getRepo();
    const original = repo.getStoreDetail;
    repo.getStoreDetail = async () => {
      throw new Error("DB connection reset (simulated)");
    };

    try {
      let caught: unknown = null;
      try {
        await requestContentGeneration(STORE_ID, "website");
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ContentGenerationError);
      const cge = caught as InstanceType<typeof ContentGenerationError>;
      expect(cge.detail.networkError).toContain("DB connection reset (simulated)");
      expect(cge.detail.requestBody).toBeNull(); // brief構築前なのでnull
      expect(cge.detail.requestUrl).toContain("/v1/contents");
    } finally {
      repo.getStoreDetail = original;
    }
  });

  it("リクエスト保存(createContentGenerationRequest)が生の例外を投げても検出できる", async () => {
    process.env.NEUMOS_API_URL = "http://127.0.0.1:1"; // 到達不可能。submitは失敗を返す(例外は投げない)
    process.env.NEUMOS_API_KEY = "test-key";

    const repo = getRepo();
    const original = repo.createContentGenerationRequest;
    repo.createContentGenerationRequest = async () => {
      throw new Error("insert failed: relation does not exist (simulated)");
    };

    try {
      let caught: unknown = null;
      try {
        await requestContentGeneration(STORE_ID, "website");
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ContentGenerationError);
      const cge = caught as InstanceType<typeof ContentGenerationError>;
      // submitContentGeneration自体の失敗詳細(接続不可)が優先して保持される
      expect(cge.detail.networkError).toBeTruthy();
      expect(cge.detail.requestUrl).toBe("http://127.0.0.1:1/v1/contents");
    } finally {
      repo.createContentGenerationRequest = original;
    }
  });
});
