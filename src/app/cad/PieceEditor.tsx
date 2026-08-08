"use client";

/**
 * 型紙（パターンピース）の一覧・作成・編集。
 * 形状は「矩形」クイック生成、または「カスタム多角形」（クリック追加＋座標テーブルの数値編集）で定義する。
 */
import { useState } from "react";
import { boundingBox, polygonArea, rectanglePoints, snap } from "@/lib/cad/geometry";
import { colorForIndex } from "@/lib/cad/constants";
import { uid } from "@/lib/cad/id";
import type { PatternPiece, Point } from "@/lib/cad/types";

const CANVAS_CM = 120;
const PX_PER_CM = 4;

type Draft = {
  id: string | null;
  name: string;
  color: string;
  grainAngle: number;
  quantity: number;
  notes: string;
  points: Point[];
};

function emptyDraft(colorIndex: number): Draft {
  return { id: null, name: "", color: colorForIndex(colorIndex), grainAngle: 0, quantity: 2, notes: "", points: [] };
}

function thumbnailViewBox(points: Point[]): string {
  if (points.length === 0) return "0 0 10 10";
  const b = boundingBox(points);
  const w = Math.max(b.maxX - b.minX, 1);
  const h = Math.max(b.maxY - b.minY, 1);
  const pad = Math.max(w, h) * 0.1;
  return `${b.minX - pad} ${b.minY - pad} ${w + pad * 2} ${h + pad * 2}`;
}

export default function PieceEditor({
  pieces,
  onAdd,
  onUpdate,
  onDelete,
}: {
  pieces: PatternPiece[];
  onAdd: (piece: PatternPiece) => void;
  onUpdate: (id: string, patch: Partial<PatternPiece>) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [shapeMode, setShapeMode] = useState<"rect" | "custom">("rect");
  const [rectW, setRectW] = useState(20);
  const [rectH, setRectH] = useState(30);

  function startCreate() {
    setDraft(emptyDraft(pieces.length));
    setShapeMode("rect");
    setRectW(20);
    setRectH(30);
  }

  function startEdit(piece: PatternPiece) {
    setDraft({
      id: piece.id,
      name: piece.name,
      color: piece.color,
      grainAngle: piece.grainAngle,
      quantity: piece.quantity,
      notes: piece.notes ?? "",
      points: piece.points,
    });
    setShapeMode("custom");
  }

  function cancel() {
    setDraft(null);
  }

  function save() {
    if (!draft) return;
    if (draft.points.length < 3) {
      window.alert("形状の頂点が3点未満です。矩形を生成するかカスタム多角形で3点以上入力してください。");
      return;
    }
    if (!draft.name.trim()) {
      window.alert("名称を入力してください。");
      return;
    }
    if (draft.id) {
      onUpdate(draft.id, {
        name: draft.name.trim(),
        color: draft.color,
        grainAngle: draft.grainAngle,
        quantity: draft.quantity,
        notes: draft.notes || undefined,
        points: draft.points,
      });
    } else {
      onAdd({
        id: uid("piece"),
        name: draft.name.trim(),
        color: draft.color,
        grainAngle: draft.grainAngle,
        quantity: draft.quantity,
        notes: draft.notes || undefined,
        points: draft.points,
      });
    }
    setDraft(null);
  }

  function handleDelete(piece: PatternPiece) {
    if (!window.confirm(`「${piece.name}」を削除しますか？配置済みのインスタンスも一緒に削除されます。`)) return;
    onDelete(piece.id);
  }

  function generateRect() {
    if (!draft) return;
    setDraft({ ...draft, points: rectanglePoints(rectW, rectH) });
  }

  function addPointFromClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!draft) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = snap(((e.clientX - rect.left) / rect.width) * CANVAS_CM, 0.5);
    const y = snap(((e.clientY - rect.top) / rect.height) * CANVAS_CM, 0.5);
    setDraft({ ...draft, points: [...draft.points, { x, y }] });
  }

  function undoPoint() {
    if (!draft) return;
    setDraft({ ...draft, points: draft.points.slice(0, -1) });
  }

  function clearPoints() {
    if (!draft) return;
    setDraft({ ...draft, points: [] });
  }

  function updatePointValue(index: number, axis: "x" | "y", value: number) {
    if (!draft) return;
    const points = draft.points.map((p, i) => (i === index ? { ...p, [axis]: value } : p));
    setDraft({ ...draft, points });
  }

  function removePoint(index: number) {
    if (!draft) return;
    setDraft({ ...draft, points: draft.points.filter((_, i) => i !== index) });
  }

  function addTablePoint() {
    if (!draft) return;
    const last = draft.points[draft.points.length - 1] ?? { x: 10, y: 10 };
    setDraft({ ...draft, points: [...draft.points, { x: last.x + 5, y: last.y + 5 }] });
  }

  if (draft) {
    const gridLines = [];
    for (let g = 0; g <= CANVAS_CM; g += 10) gridLines.push(g);
    const polygonStr = draft.points.map((p) => `${p.x},${p.y}`).join(" ");

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h2 className="font-semibold text-gray-800">{draft.id ? "型紙を編集" : "新しい型紙"}</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-xs text-gray-600 space-y-1">
            <span>名称</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="例: 前身頃"
            />
          </label>
          <label className="text-xs text-gray-600 space-y-1">
            <span>色</span>
            <input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="w-full h-8 border border-gray-300 rounded"
            />
          </label>
          <label className="text-xs text-gray-600 space-y-1">
            <span>必要枚数</span>
            <input
              type="number"
              min={1}
              value={draft.quantity}
              onChange={(e) => setDraft({ ...draft, quantity: Math.max(1, Number(e.target.value)) })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 space-y-1">
            <span>地の目角度（度・0=縦地）</span>
            <input
              type="number"
              value={draft.grainAngle}
              onChange={(e) => setDraft({ ...draft, grainAngle: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </label>
        </div>

        <label className="text-xs text-gray-600 space-y-1 block">
          <span>メモ</span>
          <input
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            placeholder="任意（縫い代込みかどうか等）"
          />
        </label>

        <div className="flex gap-1 text-sm">
          <button
            onClick={() => setShapeMode("rect")}
            className={`px-3 py-1 rounded border ${shapeMode === "rect" ? "bg-brand-600 text-white border-brand-600" : "border-gray-300"}`}
          >
            矩形から生成
          </button>
          <button
            onClick={() => setShapeMode("custom")}
            className={`px-3 py-1 rounded border ${shapeMode === "custom" ? "bg-brand-600 text-white border-brand-600" : "border-gray-300"}`}
          >
            カスタム多角形
          </button>
        </div>

        {shapeMode === "rect" && (
          <div className="flex items-end gap-3 text-xs text-gray-600">
            <label className="space-y-1">
              <span>幅 (cm)</span>
              <input
                type="number"
                value={rectW}
                onChange={(e) => setRectW(Number(e.target.value))}
                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm block"
              />
            </label>
            <label className="space-y-1">
              <span>高さ (cm)</span>
              <input
                type="number"
                value={rectH}
                onChange={(e) => setRectH(Number(e.target.value))}
                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm block"
              />
            </label>
            <button onClick={generateRect} className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm">
              矩形を生成
            </button>
          </div>
        )}

        {shapeMode === "custom" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">プレビューをクリックして頂点を追加（0.5cm単位）</span>
                <div className="flex gap-1">
                  <button onClick={undoPoint} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">
                    元に戻す
                  </button>
                  <button onClick={clearPoints} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">
                    クリア
                  </button>
                </div>
              </div>
              <svg
                onClick={addPointFromClick}
                width={CANVAS_CM * PX_PER_CM}
                height={CANVAS_CM * PX_PER_CM}
                viewBox={`0 0 ${CANVAS_CM} ${CANVAS_CM}`}
                className="border border-gray-300 rounded bg-gray-50 cursor-crosshair max-w-full"
              >
                {gridLines.map((g) => (
                  <line key={`v${g}`} x1={g} y1={0} x2={g} y2={CANVAS_CM} stroke="#e5e7eb" strokeWidth={0.2} />
                ))}
                {gridLines.map((g) => (
                  <line key={`h${g}`} x1={0} y1={g} x2={CANVAS_CM} y2={g} stroke="#e5e7eb" strokeWidth={0.2} />
                ))}
                {draft.points.length >= 2 && (
                  <polygon points={polygonStr} fill={draft.color + "55"} stroke={draft.color} strokeWidth={0.4} />
                )}
                {draft.points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={1.2} fill={draft.color} />
                ))}
              </svg>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">座標テーブル（cm）</span>
                <button onClick={addTablePoint} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">
                  + 点を追加
                </button>
              </div>
              <div className="max-h-[19rem] overflow-auto border border-gray-200 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1">#</th>
                      <th className="text-left px-2 py-1">X</th>
                      <th className="text-left px-2 py-1">Y</th>
                      <th className="px-2 py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.points.map((p, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={p.x}
                            onChange={(e) => updatePointValue(i, "x", Number(e.target.value))}
                            className="w-16 border border-gray-300 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={p.y}
                            onChange={(e) => updatePointValue(i, "y", Number(e.target.value))}
                            className="w-16 border border-gray-300 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <button onClick={() => removePoint(i)} className="text-red-500 hover:underline">
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1">頂点数: {draft.points.length} / 面積: {polygonArea(draft.points).toFixed(1)} cm²</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button onClick={save} className="px-4 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700">
            保存
          </button>
          <button onClick={cancel} className="px-4 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50">
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">生地に配置する型紙（パターンピース）を定義します。</p>
        <button onClick={startCreate} className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700">
          + 型紙を追加
        </button>
      </div>

      {pieces.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          まだ型紙がありません。「型紙を追加」から作成してください。
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {pieces.map((piece) => (
            <div key={piece.id} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              <svg viewBox={thumbnailViewBox(piece.points)} className="w-full h-24 bg-gray-50 rounded">
                <polygon
                  points={piece.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={piece.color + "55"}
                  stroke={piece.color}
                  strokeWidth={boundingBox(piece.points).maxX * 0.01 || 0.5}
                />
              </svg>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: piece.color }} />
                <span className="text-sm font-medium text-gray-800 truncate">{piece.name}</span>
              </div>
              <div className="text-xs text-gray-500">
                必要枚数 {piece.quantity} / 地の目 {piece.grainAngle}° / 面積 {polygonArea(piece.points).toFixed(0)}cm²
              </div>
              {piece.notes && <div className="text-xs text-gray-400 truncate">{piece.notes}</div>}
              <div className="flex gap-1.5 pt-1">
                <button
                  onClick={() => startEdit(piece)}
                  className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(piece)}
                  className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-red-50 text-red-600"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
