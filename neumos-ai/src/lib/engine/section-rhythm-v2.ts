/**
 * カフェv2のセクション間リズム（純関数・v1には影響しない）。
 *
 * 各セクション自身の内側の余白(py)は既にセクションごとに差別化しているが、
 * それだけだと「隣り合うセクションの間隔」はpy同士の合計に過ぎず、意図された
 * リズムにならない。ここではブロックの遷移（前のブロック→次のブロック）ごとに
 * 明示的な間隔を割り当て、「Hero→Storyは大きく間を置く」「Story→Galleryは
 * 詰める」のような強弱を作る。値はページ全体で一律にしない（＝同じ余白の
 * 反復を避ける）ことが目的なので、Hero直後（0）を除く各遷移ペアには
 * それぞれ異なる値を意図的に割り当てている。
 *
 * Tailwindの静的解析に乗せるため、クラス名は必ずこのファイル内に
 * リテラル文字列として書く（動的な文字列結合はしない）。
 */
import type { CafeV2BlockId } from "./section-plan-v2";

const GAP_BY_TRANSITION: Record<string, string> = {
  "hero->signature": "mt-0",
  "hero->story": "mt-[120px] sm:mt-[220px]",
  "signature->story": "mt-[80px] sm:mt-[140px]",
  "story->photoStory": "mt-[70px] sm:mt-[120px]",
  "story->menu": "mt-[95px] sm:mt-[170px]",
  "story->trust": "mt-[105px] sm:mt-[190px]",
  "story->accessHours": "mt-[85px] sm:mt-[150px]",
  "photoStory->menu": "mt-[140px] sm:mt-[260px]",
  "photoStory->trust": "mt-[125px] sm:mt-[230px]",
  "photoStory->accessHours": "mt-[110px] sm:mt-[200px]",
  "menu->trust": "mt-[115px] sm:mt-[210px]",
  "menu->accessHours": "mt-[75px] sm:mt-[135px]",
  "trust->accessHours": "mt-[60px] sm:mt-[100px]",
  "accessHours->cta": "mt-[180px] sm:mt-[320px]",
};

/** 遷移テーブルに無い組み合わせ（将来ブロックを追加した場合の保険）用の既定値。 */
const DEFAULT_GAP = "mt-[120px] sm:mt-[200px]";

export function getSectionGapClass(prev: CafeV2BlockId | null, next: CafeV2BlockId): string {
  if (prev === null) return "";
  return GAP_BY_TRANSITION[`${prev}->${next}`] ?? DEFAULT_GAP;
}
