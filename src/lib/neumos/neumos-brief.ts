/**
 * NeumosBrief 組み立て（純関数）。
 * - StoreStrategy の generationBrief（種別非依存の核）に generationType を付与し、
 *   ノイモスAIへ渡す最終JSON契約 NeumosBrief を作る。
 * - 同じ StoreStrategy から generationType を変えるだけで各コンテンツ用ブリーフになる。
 */
import type { StoreStrategy, NeumosBrief, GenerationType } from "@/lib/types";

export function buildNeumosBrief(
  strategy: StoreStrategy,
  generationType: GenerationType = "website"
): NeumosBrief {
  return {
    ...strategy.generationBrief,
    generationType,
  };
}
