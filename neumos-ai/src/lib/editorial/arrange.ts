/**
 * 編集パイプラインのArrange段。固定のカテゴリ順序(外観→内観→商品等)は持たない。
 * neumos-ai/docs/design/editorial-pipeline-design.md 8章。
 *
 * `ArrangeStrategy`は「コスト関数の差し替え」ではなく「経路生成アルゴリズム
 * 全体の差し替え」まで許容するインターフェースにしてある。今回実装するのは
 * `clusterStrategy`(内部でNearestNeighbor+2-optをsimilarityCost経由で呼ぶ)
 * のみ。将来のRhythmStrategy(系列全体の履歴・位置・連続長を見て交互配置を
 * 作る戦略)はcost()を経由せずbuildPath内で自由に経路を組み立ててよい。
 *
 * 画像とテキストの間の「意味的な近さ」は計算できない(捏造しない)ため、
 * `arrangeArtifacts`は画像列・テキスト列をそれぞれ独立に`strategy.buildPath`へ
 * 渡し、種別をまたぐ配置は同一種別の連続数の固定上限によるマージでのみ決める
 * (周期的な固定リズムのテンプレートではなく、上限に達した場合のみ発動する)。
 */
import { hashToIndex } from "@/lib/engine/deterministic-hash";
import { type Artifact, isImageArtifact, isTextArtifact } from "./artifact";
import { hammingDistance, textJaccardSimilarity } from "./similarity";

export type ArrangeCostFn = (a: Artifact, b: Artifact) => number;

/** 経路生成コンテキスト。将来の戦略が履歴・位置・連続長を参照できるようにするための引数。 */
export interface ArrangeContext {
  /** 決定的tie-break用のseed(deterministic-hash.tsへ渡す)。 */
  seed: string;
}

export interface ArrangeStrategy {
  name: string;
  /** 経路生成そのものを担う。内部実装は自由(cost()を経由する必要はない)。 */
  buildPath(artifacts: Artifact[], ctx: ArrangeContext): Artifact[];
}

const MAX_HAMMING_BITS = 64;

/**
 * 同一媒体のArtifact間の距離。画像同士はCompressが計算済みのdHash(hashフィールド)
 * をそのまま再利用し、再フェッチ・再デコードしない。テキスト同士はJaccard距離。
 * 異なるmedia同士の比較は`arrangeArtifacts`が画像列・テキスト列を分離して
 * `buildPath`へ渡すため通常発生しないが、念のため中立値(意味的な近さを
 * 捏造しない)を返す。
 */
export function similarityCost(a: Artifact, b: Artifact): number {
  if (isImageArtifact(a) && isImageArtifact(b)) {
    if (a.hash === undefined || b.hash === undefined) return MAX_HAMMING_BITS / 2;
    return hammingDistance(a.hash, b.hash);
  }
  if (isTextArtifact(a) && isTextArtifact(b)) {
    return (1 - textJaccardSimilarity(a.text, b.text)) * MAX_HAMMING_BITS;
  }
  return MAX_HAMMING_BITS / 2;
}

function nearestNeighborPath(items: readonly Artifact[], cost: ArrangeCostFn, seed: string): number[] {
  const n = items.length;
  if (n === 0) return [];

  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    if (items[i].sourceOrder < items[startIdx].sourceOrder) startIdx = i;
  }

  const visited = new Array(n).fill(false);
  const order: number[] = [startIdx];
  visited[startIdx] = true;

  for (let step = 1; step < n; step++) {
    const current = items[order[order.length - 1]];
    let bestCost = Infinity;
    let candidates: number[] = [];
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const c = cost(current, items[i]);
      if (c < bestCost) {
        bestCost = c;
        candidates = [i];
      } else if (c === bestCost) {
        candidates.push(i);
      }
    }
    let chosen: number;
    if (candidates.length === 1) {
      chosen = candidates[0];
    } else {
      const sorted = [...candidates].sort((x, y) => items[x].sourceOrder - items[y].sourceOrder);
      chosen = sorted[hashToIndex(`${seed}:nn:${step}`, sorted.length)];
    }
    visited[chosen] = true;
    order.push(chosen);
  }
  return order;
}

const MAX_TWO_OPT_ITERATIONS = 200;
/** N>60の理論上の異常系では2-optを打ち切り、最近傍法の結果のみ採用する安全弁。 */
const TWO_OPT_SAFETY_GUARD_N = 60;

function twoOptImprove(initialOrder: readonly number[], items: readonly Artifact[], cost: ArrangeCostFn): number[] {
  const n = initialOrder.length;
  let order = [...initialOrder];
  if (n <= 3) return order;

  let improved = true;
  let iterations = 0;
  while (improved && iterations < MAX_TWO_OPT_ITERATIONS) {
    improved = false;
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n - 1; j++) {
        const a = items[order[i]];
        const b = items[order[i + 1]];
        const c = items[order[j]];
        const d = items[order[j + 1]];
        const before = cost(a, b) + cost(c, d);
        const after = cost(a, c) + cost(b, d);
        if (after < before) {
          order = [...order.slice(0, i + 1), ...order.slice(i + 1, j + 1).reverse(), ...order.slice(j + 1)];
          improved = true;
        }
      }
    }
    iterations++;
  }
  return order;
}

/** 決定的最近傍法で初期経路を構築し、N<=60ならさらに2-optで局所改善する。 */
export function nearestNeighborThenTwoOpt(items: readonly Artifact[], cost: ArrangeCostFn, seed: string): Artifact[] {
  if (items.length <= 1) return [...items];
  let order = nearestNeighborPath(items, cost, seed);
  if (items.length <= TWO_OPT_SAFETY_GUARD_N) {
    order = twoOptImprove(order, items, cost);
  }
  return order.map((i) => items[i]);
}

/** 既定戦略。類似度最小化(=クラスタリング)。今回実装するのはこの1戦略のみ。 */
export const clusterStrategy: ArrangeStrategy = {
  name: "cluster",
  buildPath(artifacts, ctx) {
    return nearestNeighborThenTwoOpt(artifacts, similarityCost, ctx.seed);
  },
};

/** 同一種別がこの件数以上連続したら、他方の系列から1件だけ差し込む(周期ではなく上限)。 */
const MAX_SAME_MEDIA_RUN = 4;

function mergeWithRunLengthCap(primary: readonly Artifact[], secondary: readonly Artifact[]): Artifact[] {
  const result: Artifact[] = [];
  let secondaryIdx = 0;
  let run = 0;
  for (const item of primary) {
    result.push(item);
    run++;
    if (run >= MAX_SAME_MEDIA_RUN && secondaryIdx < secondary.length) {
      result.push(secondary[secondaryIdx]);
      secondaryIdx++;
      run = 0;
    }
  }
  while (secondaryIdx < secondary.length) {
    result.push(secondary[secondaryIdx]);
    secondaryIdx++;
  }
  return result;
}

/**
 * 画像列・テキスト列をそれぞれ`strategy.buildPath`で独立に並べ、
 * 同一種別の連続数の固定上限でのみマージする。`strategy`省略時は
 * `clusterStrategy`(既定動作、後方互換)。`seed`は決定的tie-break用
 * (省略時は固定文字列。呼び出し側でrequestId等を渡すことを想定)。
 */
export function arrangeArtifacts(
  compressed: readonly Artifact[],
  strategy: ArrangeStrategy = clusterStrategy,
  seed: string = "arrange"
): Artifact[] {
  const images = compressed.filter(isImageArtifact);
  const texts = compressed.filter(isTextArtifact);
  const ctx: ArrangeContext = { seed };

  const orderedImages = strategy.buildPath(images, ctx);
  const orderedTexts = strategy.buildPath(texts, ctx);

  if (orderedImages.length === 0) return orderedTexts;
  if (orderedTexts.length === 0) return orderedImages;
  return mergeWithRunLengthCap(orderedImages, orderedTexts);
}
