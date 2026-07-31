/**
 * NeumosBrief 組み立て（純関数）。
 * - StoreStrategy の generationBrief（種別非依存の核）に generationType を付与し、
 *   ノイモスAIへ渡す最終JSON契約 NeumosBrief を作る。
 * - 同じ StoreStrategy から generationType を変えるだけで各コンテンツ用ブリーフになる。
 */
import type { StoreStrategy, NeumosBrief, GenerationType } from "@/lib/types";

/**
 * 店舗オーナー向けの営業診断文を、来店客が読むWebサイトへ流用しない。
 * 診断データそのものは変更せず、カフェのwebsite生成へ渡す最終ブリーフだけを
 * 店舗名・地域・業種という確認済み情報から組み直す。
 */
function buildCustomerFacingCafeBrief(brief: StoreStrategy["generationBrief"]): StoreStrategy["generationBrief"] {
  return {
    ...brief,
    targetCustomer: `${brief.area}で、ほっとひと息つける場所を探している方`,
    mainProblem: "初めてでも安心して立ち寄れる場所を探している",
    salesAngle: "店内で過ごす時間と、その店らしい雰囲気",
    websiteGoal: "営業時間や場所、店内の雰囲気を分かりやすく伝える",
    siteConcept: `${brief.storeName}で過ごす時間を、写真と店舗情報で丁寧に伝える`,
    offer: `${brief.storeName}で過ごす、ほっとひと息つける時間`,
  };
}

export function buildNeumosBrief(
  strategy: StoreStrategy,
  generationType: GenerationType = "website"
): NeumosBrief {
  const generationBrief =
    generationType === "website" && /カフェ|cafe/i.test(strategy.generationBrief.industry)
      ? buildCustomerFacingCafeBrief(strategy.generationBrief)
      : strategy.generationBrief;
  return {
    ...generationBrief,
    generationType,
  };
}
