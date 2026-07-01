import { describe, it, expect, afterEach } from "vitest";
import {
  normalizeNeumosStatus,
  isNeumosConfigured,
  submitContentGeneration,
  getContentGenerationStatus,
} from "@/lib/neumos/client";
import type { NeumosBrief } from "@/lib/types";

const brief: NeumosBrief = {
  storeName: "海風食堂",
  industry: "飲食店",
  area: "那覇市",
  targetCustomer: "地域客",
  mainProblem: "HP無し",
  salesAngle: "予約導線",
  websiteGoal: "予約獲得",
  siteConcept: "料理の魅力",
  recommendedPages: ["TOP"],
  seoKeywords: ["那覇市 飲食店"],
  tone: "温かみ",
  offer: "HP制作",
  generationType: "website",
};

afterEach(() => {
  delete process.env.NEUMOS_API_URL;
  delete process.env.NEUMOS_API_KEY;
});

describe("normalizeNeumosStatus", () => {
  it("多様な表記を内部statusへ正規化する", () => {
    expect(normalizeNeumosStatus("pending")).toBe("queued");
    expect(normalizeNeumosStatus("processing")).toBe("generating");
    expect(normalizeNeumosStatus("ready")).toBe("preview");
    expect(normalizeNeumosStatus("live")).toBe("published");
    expect(normalizeNeumosStatus("error")).toBe("failed");
    expect(normalizeNeumosStatus("unknown-xyz")).toBe("queued");
  });
});

describe("Neumos 未接続時のフォールバック", () => {
  it("env未設定なら isNeumosConfigured=false", () => {
    expect(isNeumosConfigured()).toBe(false);
  });

  it("submit は not_configured を返す（例外を投げない）", async () => {
    const r = await submitContentGeneration(brief);
    expect(r.status).toBe("not_configured");
  });

  it("status取得も not_configured を返す", async () => {
    const r = await getContentGenerationStatus("req_123");
    expect(r.status).toBe("not_configured");
  });
});
