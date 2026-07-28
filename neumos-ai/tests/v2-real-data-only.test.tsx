import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { WebsiteRendererV2 } from "@/components/website-v2/WebsiteRendererV2";
import type { StoreBrief } from "@/lib/types";

/**
 * v2は「実データがある項目だけを表示し、無ければ架空の値を作らない」ことを
 * 最優先の制約とする。このファイルはTrust（評価・SNS）とMenu（品目・価格）を
 * 中心に、実データが無いケースで何も捏造されないことを回帰確認する。
 *
 * なお過去に実施したPlaywright目視確認のスクリーンショットに写っていた
 * "★4.6"/"★4.7"等の値は、検証用に手動で組み立てたテストリクエストの
 * `realData.googleRating`にそのまま入力した値であり、エンジン側が生成・
 * 補完したものではない（`googleRating`/`googleReviewCount`は
 * `TrustV2`/`section-plan-v2.ts`/`StoreInfoCard`のいずれも`brief.realData`から
 * しか読まず、既定値・フォールバック値は一切持たないことをコード上確認済み）。
 */
const cafeBrief: StoreBrief = {
  storeName: "BB-Coffee",
  industry: "カフェ",
  area: "沖縄市",
  targetCustomer: "地元客・観光客",
  mainProblem: "新規客の獲得が伸び悩んでいる",
  salesAngle: "自家焙煎の香りと落ち着いた店内体験",
  websiteGoal: "来店予約とInstagramフォローの増加",
  siteConcept: "焙煎の香りが伝わる、静かな時間を過ごせるカフェ",
  recommendedPages: ["トップ"],
  seoKeywords: ["沖縄市 カフェ"],
  tone: "落ち着いた・上質",
  offer: "本日の一杯 500円〜",
};

describe("v2: Trustセクションは実データが無ければ何も表示しない", () => {
  it("realData自体が無い場合、評価・レビュー・Instagram導線のいずれも出ない", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} />);
    expect(html).not.toContain('id="trust"');
    expect(html).not.toContain("★");
    expect(html).not.toContain("Google Reviews");
    // "Instagram"という単語自体はbrief.websiteGoal（"...Instagramフォローの増加"）由来の
    // 生成コピーに含まれ得るため、ここではTrustV2が出すInstagram導線特有の文言
    // （instagramUrlが無ければ絶対に出ないリンク文言）だけを確認する。
    expect(html).not.toContain("Instagramで見る");
    expect(html).not.toContain("Instagramを見る");
  });

  it("realDataはあるがrating/reviewCount/instagramUrlのいずれも無い場合も同様に出ない", () => {
    const brief: StoreBrief = { ...cafeBrief, realData: { address: "沖縄県沖縄市...", photoUrls: [] } };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).not.toContain('id="trust"');
    expect(html).not.toContain("★");
  });

  it("ratingのみ存在する場合、Google評価ブロックは表示しない（件数の裏付けが無いため）", () => {
    const brief: StoreBrief = { ...cafeBrief, realData: { googleRating: 4.8 } };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).not.toContain('id="trust"');
    expect(html).not.toContain("★");
  });

  it("reviewCountのみ存在する場合、Google評価ブロックは表示しない（評価値そのものが無いため）", () => {
    const brief: StoreBrief = { ...cafeBrief, realData: { googleReviewCount: 52 } };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).not.toContain('id="trust"');
    expect(html).not.toContain("件のレビューより");
  });

  it("ratingとreviewCountの両方が揃った場合だけGoogle評価ブロックを表示する", () => {
    const brief: StoreBrief = { ...cafeBrief, realData: { googleRating: 4.8, googleReviewCount: 33 } };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).toContain('id="trust"');
    expect(html).toContain("★4.8");
    expect(html).toContain("33件のレビューより");
  });

  it("instagramUrlのみ存在する場合、Google評価が無くてもTrustセクションが代替信頼要素として表示される", () => {
    const brief: StoreBrief = { ...cafeBrief, realData: { instagramUrl: "https://instagram.com/bb_coffee" } };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).toContain('id="trust"');
    expect(html).toContain('href="https://instagram.com/bb_coffee"');
    expect(html).not.toContain("Google Reviews");
    expect(html).not.toContain("★");
  });

  it("ratingとinstagramUrlの両方がある場合、両方表示される", () => {
    const brief: StoreBrief = {
      ...cafeBrief,
      realData: { googleRating: 4.6, googleReviewCount: 128, instagramUrl: "https://instagram.com/bb_coffee" },
    };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).toContain("★4.6");
    expect(html).toContain('href="https://instagram.com/bb_coffee"');
  });
});

describe("v2: Menuセクションは実メニューが無ければ商品名・価格を捏造しない", () => {
  it("realData.menuItemsが無い場合、brief自身の事実情報(提供内容/こだわり/こんな方に)による編集的パネルとして表示し、価格の一覧は出さない", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} />);
    expect(html).toContain('id="menu"');
    expect(html).toContain("提供内容とこだわり");
    expect(html).toContain("提供内容");
    expect(html).toContain("こだわり");
    expect(html).toContain("こんな方に");
    expect(html).toContain(cafeBrief.offer);
    expect(html).not.toContain("tabular-nums");
  });

  it("realData.menuItemsがある場合、実際の品名・価格を表示し、事実情報パネルの見出しは出ない", () => {
    const brief: StoreBrief = {
      ...cafeBrief,
      realData: {
        menuItems: [
          { name: "ハンドドリップ ブレンド", price: "600円", description: "自家焙煎の中煎り" },
          { name: "自家製シフォンケーキ", price: "450円" },
        ],
      },
    };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).toContain("ハンドドリップ ブレンド");
    expect(html).toContain("600円");
    expect(html).toContain("自家製シフォンケーキ");
    expect(html).toContain("450円");
    expect(html).not.toContain("提供内容とこだわり");
  });

  it("brief.offerの文字列はメニューの品目・価格としては描画されない（自由記述のままでは商品化しない）", () => {
    const brief: StoreBrief = { ...cafeBrief, offer: "本日の一杯 500円〜" };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    // MenuV2がRealMenuList(価格をtabular-numsで右寄せする専用マークアップ)を
    // 使わず、事実情報(提供内容=brief.offerそのもの)として再構成されている
    // ことだけを確認する。商品名・価格の一覧としては描画されない。
    expect(html).toContain("提供内容とこだわり");
    expect(html).toContain(brief.offer);
    expect(html).not.toContain("tabular-nums");
  });
});

describe("v2: 写真の切り取り位置は常に中央固定（Vision焦点情報が無いため推測しない）", () => {
  it("ParallaxImageV2はobject-centerを使い、固定の推測位置(object-[68%_38%]相当)は使わない", () => {
    const brief: StoreBrief = { ...cafeBrief, realData: { photoUrls: ["https://example.com/a.jpg"] } };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).toContain("object-center");
    expect(html).not.toContain("object-[68%_38%]");
  });
});
