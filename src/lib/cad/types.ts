/**
 * 衣料品パターンレイアウトCAD — ドメイン型。
 * 単位はすべて cm。座標系は生地シート左上を原点とする。
 */

export type Point = { x: number; y: number };

/** 型紙（パターンピース）。ローカル座標（cm）で輪郭を保持する。 */
export type PatternPiece = {
  id: string;
  name: string;
  color: string;
  points: Point[];
  /** 地の目線の角度（度）。0 = 生地の長さ方向（縦地）に平行。 */
  grainAngle: number;
  /** この型紙が必要な枚数（裁断枚数の目安）。 */
  quantity: number;
  notes?: string;
};

/** 生地シート（表地・裏地・接着芯など）。 */
export type Fabric = {
  id: string;
  name: string;
  widthCm: number;
  lengthCm: number;
  color: string;
};

/** 生地シート上に配置された型紙インスタンス。 */
export type Placement = {
  id: string;
  pieceId: string;
  fabricId: string;
  /** 型紙の重心を置くターゲット座標（cm）。 */
  x: number;
  y: number;
  /** 追加回転角（度）。 */
  rotation: number;
  mirrored: boolean;
};

export type CadProject = {
  id: string;
  name: string;
  fabrics: Fabric[];
  pieces: PatternPiece[];
  placements: Placement[];
  updatedAt: string;
};

export type SavedProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
};
