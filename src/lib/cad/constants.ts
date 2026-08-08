/** 型紙に順番に割り当てる配色パレット（生地の上で見分けやすい濃色中心）。 */
export const PIECE_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#4338ca",
  "#ea580c",
];

export function colorForIndex(index: number): string {
  return PIECE_COLORS[index % PIECE_COLORS.length];
}
