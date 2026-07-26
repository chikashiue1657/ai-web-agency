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
 * 第3引数`rhythm`はBrand Director接続用の任意拡張（省略時は既定の"staggered"で
 * 従来と完全に同一の値）。brandArchetypeに応じて"airy"（より大きくゆったり）・
 * "dense"（より詰めて密度高く）を切り替えられるようにするため、遷移テーブル
 * 自体を3種類（staggered/airy/dense）用意する。
 *
 * Tailwindの静的解析に乗せるため、クラス名は必ずこのファイル内に
 * リテラル文字列として書く（動的な文字列結合はしない）。
 */
import type { CafeV2BlockId } from "./section-plan-v2";
import type { SectionRhythm } from "./v2-design-system";

const GAP_BY_TRANSITION_STAGGERED: Record<string, string> = {
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

/** "airy"（luxury-quiet/wellness-calm向け）: staggeredの約1.35倍、より大きくゆったり。 */
const GAP_BY_TRANSITION_AIRY: Record<string, string> = {
  "hero->signature": "mt-0",
  "hero->story": "mt-[160px] sm:mt-[300px]",
  "signature->story": "mt-[110px] sm:mt-[190px]",
  "story->photoStory": "mt-[95px] sm:mt-[160px]",
  "story->menu": "mt-[130px] sm:mt-[230px]",
  "story->trust": "mt-[140px] sm:mt-[260px]",
  "story->accessHours": "mt-[115px] sm:mt-[200px]",
  "photoStory->menu": "mt-[190px] sm:mt-[350px]",
  "photoStory->trust": "mt-[170px] sm:mt-[310px]",
  "photoStory->accessHours": "mt-[150px] sm:mt-[270px]",
  "menu->trust": "mt-[155px] sm:mt-[280px]",
  "menu->accessHours": "mt-[100px] sm:mt-[180px]",
  "trust->accessHours": "mt-[80px] sm:mt-[135px]",
  "accessHours->cta": "mt-[240px] sm:mt-[430px]",
};

/** "dense"（energetic-casual向け）: staggeredの約0.55倍、より詰めて密度高く。 */
const GAP_BY_TRANSITION_DENSE: Record<string, string> = {
  "hero->signature": "mt-0",
  "hero->story": "mt-[65px] sm:mt-[120px]",
  "signature->story": "mt-[45px] sm:mt-[75px]",
  "story->photoStory": "mt-[40px] sm:mt-[65px]",
  "story->menu": "mt-[50px] sm:mt-[95px]",
  "story->trust": "mt-[55px] sm:mt-[105px]",
  "story->accessHours": "mt-[45px] sm:mt-[85px]",
  "photoStory->menu": "mt-[75px] sm:mt-[145px]",
  "photoStory->trust": "mt-[70px] sm:mt-[125px]",
  "photoStory->accessHours": "mt-[60px] sm:mt-[110px]",
  "menu->trust": "mt-[65px] sm:mt-[115px]",
  "menu->accessHours": "mt-[40px] sm:mt-[75px]",
  "trust->accessHours": "mt-[35px] sm:mt-[55px]",
  "accessHours->cta": "mt-[100px] sm:mt-[175px]",
};

const TABLES: Record<SectionRhythm, Record<string, string>> = {
  staggered: GAP_BY_TRANSITION_STAGGERED,
  airy: GAP_BY_TRANSITION_AIRY,
  dense: GAP_BY_TRANSITION_DENSE,
};

/** 遷移テーブルに無い組み合わせ（将来ブロックを追加した場合の保険）用の既定値。 */
const DEFAULT_GAP: Record<SectionRhythm, string> = {
  staggered: "mt-[120px] sm:mt-[200px]",
  airy: "mt-[160px] sm:mt-[270px]",
  dense: "mt-[65px] sm:mt-[110px]",
};

export function getSectionGapClass(
  prev: CafeV2BlockId | null,
  next: CafeV2BlockId,
  rhythm: SectionRhythm = "staggered"
): string {
  if (prev === null) return "";
  return TABLES[rhythm][`${prev}->${next}`] ?? DEFAULT_GAP[rhythm];
}
