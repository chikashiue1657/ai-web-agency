import { describe, expect, it } from "vitest";
import { buildHeroTitle, buildHeroSubtitle } from "@/lib/engine/hero-copy";
import { HERO_TITLE_MAX, HERO_SUBTITLE_MAX } from "@/lib/engine/copy-limits";
import type { StoreBrief } from "@/lib/types";

function makeBrief(overrides: Partial<StoreBrief> = {}): StoreBrief {
  return {
    storeName: "テスト店",
    industry: "その他",
    area: "那覇市",
    targetCustomer: "地域客",
    mainProblem: "新規客が少ない",
    salesAngle: "検索流入の確立",
    websiteGoal: "予約増加",
    siteConcept: "居心地の良いサイト",
    recommendedPages: [],
    seoKeywords: [],
    tone: "親しみやすい",
    offer: "初回無料",
    ...overrides,
  };
}

describe("buildHeroTitle", () => {
  it("カフェは「毎日通いたくなる」型の見出しになる", () => {
    const title = buildHeroTitle(makeBrief({ storeName: "喫茶ふう", industry: "カフェ" }));
    expect(title).toContain("喫茶ふう");
    expect(title).toContain("毎日通いたくなる");
  });

  it("美容室は施策説明ではなくアスピレーショナルな見出しになる", () => {
    const title = buildHeroTitle(makeBrief({ industry: "美容室" }));
    expect(title).toBe("あなた史上最高の髪へ");
  });

  it("整体はofferベースの根本改善型見出しになる", () => {
    const title = buildHeroTitle(makeBrief({ industry: "整体院", offer: "猫背矯正" }));
    expect(title).toContain("猫背矯正");
    expect(title).toContain("根本から変わる");
  });

  it("未分類の業種はstoreName＋salesAngleの汎用見出し（フォールバック）になる", () => {
    const title = buildHeroTitle(makeBrief({ industry: "ジム", storeName: "Gym X", salesAngle: "本気の減量支援" }));
    expect(title).toContain("Gym X");
    expect(title).toContain("本気の減量支援");
  });

  it("長いsalesAngleでも上限文字数を超えない", () => {
    const title = buildHeroTitle(
      makeBrief({
        industry: "ジム",
        salesAngle: "非常に長い施策説明文がここにずっと続いていくケースを想定したテスト用の文章です",
      })
    );
    expect(title.length).toBeLessThanOrEqual(HERO_TITLE_MAX);
  });
});

describe("buildHeroSubtitle", () => {
  it("上限文字数を超えない", () => {
    const subtitle = buildHeroSubtitle(
      makeBrief({ industry: "ホテル", offer: "オーシャンビュースイート" }),
      "長いターゲットペルソナの説明がここにずっと続いていく想定のテキストです"
    );
    expect(subtitle.length).toBeLessThanOrEqual(HERO_SUBTITLE_MAX);
  });
});
