"use client";

/**
 * 生地シート上への型紙配置キャンバス（SVGベース）。
 * ドラッグで移動、回転/ミラー/複製/削除はボタン or キーボードショートカット
 * （R:回転15°／Shift+R:逆回転、M:ミラー、D:複製、矢印キー:移動、Delete:削除）。
 * 重なり・生地はみ出しは色で警告表示するのみ（強制的な禁止はしない）。
 */
import { useEffect, useRef, useState } from "react";
import {
  boundingBox,
  centroid,
  polygonArea,
  polygonWithinBounds,
  polygonsIntersect,
  snap,
  transformPolygon,
} from "@/lib/cad/geometry";
import { downloadBlob } from "@/lib/cad/download";
import { uid } from "@/lib/cad/id";
import type { Fabric, PatternPiece, Placement } from "@/lib/cad/types";

const SNAP_OPTIONS = [0, 0.5, 1, 2, 5];

export default function LayoutBoard({
  fabrics,
  pieces,
  placements,
  onAddFabric,
  onUpdateFabric,
  onDeleteFabric,
  onAddPlacement,
  onUpdatePlacement,
  onDeletePlacement,
  onDuplicatePlacement,
}: {
  fabrics: Fabric[];
  pieces: PatternPiece[];
  placements: Placement[];
  onAddFabric: (fabric: Fabric) => void;
  onUpdateFabric: (id: string, patch: Partial<Fabric>) => void;
  onDeleteFabric: (id: string) => void;
  onAddPlacement: (placement: Placement) => void;
  onUpdatePlacement: (id: string, patch: Partial<Placement>) => void;
  onDeletePlacement: (id: string) => void;
  onDuplicatePlacement: (id: string) => void;
}) {
  const [activeFabricId, setActiveFabricId] = useState<string | null>(fabrics[0]?.id ?? null);
  const [addingFabric, setAddingFabric] = useState(false);
  const [newFabric, setNewFabric] = useState({ name: "裏地", widthCm: 150, lengthCm: 150 });
  const [pxPerCm, setPxPerCm] = useState(3);
  const [snapCm, setSnapCm] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    if (!fabrics.find((f) => f.id === activeFabricId)) {
      setActiveFabricId(fabrics[0]?.id ?? null);
    }
  }, [fabrics, activeFabricId]);

  const activeFabric = fabrics.find((f) => f.id === activeFabricId) ?? null;
  const placementsOnActive = activeFabric ? placements.filter((p) => p.fabricId === activeFabric.id) : [];
  const selectedPlacement = placements.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!selectedId) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const placement = placements.find((p) => p.id === selectedId);
      if (!placement) return;
      if (e.key === "r" || e.key === "R") {
        onUpdatePlacement(selectedId, { rotation: placement.rotation + (e.shiftKey ? -15 : 15) });
        e.preventDefault();
      } else if (e.key === "m" || e.key === "M") {
        onUpdatePlacement(selectedId, { mirrored: !placement.mirrored });
        e.preventDefault();
      } else if (e.key === "d" || e.key === "D") {
        onDuplicatePlacement(selectedId);
        e.preventDefault();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        onDeletePlacement(selectedId);
        setSelectedId(null);
        e.preventDefault();
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const step = snapCm > 0 ? snapCm : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        onUpdatePlacement(selectedId, { x: placement.x + dx, y: placement.y + dy });
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, placements, snapCm, onUpdatePlacement, onDeletePlacement, onDuplicatePlacement]);

  function handleAddFabricConfirm() {
    if (!newFabric.name.trim() || newFabric.widthCm <= 0 || newFabric.lengthCm <= 0) return;
    const fabric: Fabric = { id: uid("fabric"), name: newFabric.name.trim(), widthCm: newFabric.widthCm, lengthCm: newFabric.lengthCm, color: "#ffffff" };
    onAddFabric(fabric);
    setActiveFabricId(fabric.id);
    setAddingFabric(false);
    setNewFabric({ name: "裏地", widthCm: 150, lengthCm: 150 });
  }

  function handleDeleteFabric() {
    if (!activeFabric) return;
    if (fabrics.length <= 1) {
      window.alert("最後の1枚は削除できません。");
      return;
    }
    if (!window.confirm(`生地「${activeFabric.name}」と、その上に配置された型紙をすべて削除しますか？`)) return;
    onDeleteFabric(activeFabric.id);
  }

  function addPieceInstance(piece: PatternPiece) {
    if (!activeFabric) return;
    const countOnFabric = placementsOnActive.filter((p) => p.pieceId === piece.id).length;
    const cascade = countOnFabric % 6;
    const bbox = boundingBox(piece.points);
    const w = Math.max(bbox.maxX - bbox.minX, 1);
    const h = Math.max(bbox.maxY - bbox.minY, 1);
    const placement: Placement = {
      id: uid("place"),
      pieceId: piece.id,
      fabricId: activeFabric.id,
      x: Math.min(w / 2 + 5 + cascade * 3, activeFabric.widthCm - w / 2),
      y: Math.min(h / 2 + 5 + cascade * 3, activeFabric.lengthCm - h / 2),
      rotation: 0,
      mirrored: false,
    };
    onAddPlacement(placement);
    setSelectedId(placement.id);
  }

  function handlePointerDown(e: React.PointerEvent, placement: Placement) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setSelectedId(placement.id);
    dragRef.current = { id: placement.id, startClientX: e.clientX, startClientY: e.clientY, startX: placement.x, startY: placement.y };
  }

  function handlePointerMove(e: React.PointerEvent, placement: Placement) {
    const ds = dragRef.current;
    if (!ds || ds.id !== placement.id) return;
    const deltaXcm = (e.clientX - ds.startClientX) / pxPerCm;
    const deltaYcm = (e.clientY - ds.startClientY) / pxPerCm;
    const newX = snap(ds.startX + deltaXcm, snapCm);
    const newY = snap(ds.startY + deltaYcm, snapCm);
    onUpdatePlacement(placement.id, { x: newX, y: newY });
  }

  function handlePointerUp(e: React.PointerEvent) {
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // すでに解放済みの場合は無視
    }
  }

  function exportSvg() {
    if (!svgRef.current || !activeFabric) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", `${activeFabric.widthCm}cm`);
    clone.setAttribute("height", `${activeFabric.lengthCm}cm`);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const src = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([src], { type: "image/svg+xml" });
    downloadBlob(blob, `${activeFabric.name || "fabric"}-layout.svg`);
  }

  // --- 統計 ---
  const usedAreaByFabric = new Map<string, number>();
  const overlapPairIds = new Set<string>();
  for (const fabric of fabrics) {
    const onFabric = placements.filter((p) => p.fabricId === fabric.id);
    let used = 0;
    for (let i = 0; i < onFabric.length; i++) {
      const piece = pieces.find((p) => p.id === onFabric[i].pieceId);
      if (piece) used += polygonArea(piece.points);
      for (let j = i + 1; j < onFabric.length; j++) {
        const pieceA = pieces.find((p) => p.id === onFabric[i].pieceId);
        const pieceB = pieces.find((p) => p.id === onFabric[j].pieceId);
        if (!pieceA || !pieceB) continue;
        const ptsA = transformPolygon(pieceA.points, onFabric[i]);
        const ptsB = transformPolygon(pieceB.points, onFabric[j]);
        if (polygonsIntersect(ptsA, ptsB)) {
          overlapPairIds.add(onFabric[i].id);
          overlapPairIds.add(onFabric[j].id);
        }
      }
    }
    usedAreaByFabric.set(fabric.id, used);
  }

  if (fabrics.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
        生地がありません。まず生地を追加してください。
        <div className="mt-3">
          <button onClick={() => setAddingFabric(true)} className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm">
            生地を追加
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {fabrics.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFabricId(f.id)}
            className={`px-3 py-1.5 rounded text-sm border ${
              f.id === activeFabricId ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            {f.name}
            <span className="text-xs opacity-70 ml-1">
              ({f.widthCm}×{f.lengthCm})
            </span>
          </button>
        ))}
        <button onClick={() => setAddingFabric((v) => !v)} className="px-2.5 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-sm">
          + 生地
        </button>
      </div>

      {addingFabric && (
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-end gap-3 text-xs text-gray-600">
          <label className="space-y-1">
            <span>名前</span>
            <input
              value={newFabric.name}
              onChange={(e) => setNewFabric({ ...newFabric, name: e.target.value })}
              className="w-32 border border-gray-300 rounded px-2 py-1 text-sm block"
            />
          </label>
          <label className="space-y-1">
            <span>幅 (cm)</span>
            <input
              type="number"
              value={newFabric.widthCm}
              onChange={(e) => setNewFabric({ ...newFabric, widthCm: Number(e.target.value) })}
              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm block"
            />
          </label>
          <label className="space-y-1">
            <span>長さ (cm)</span>
            <input
              type="number"
              value={newFabric.lengthCm}
              onChange={(e) => setNewFabric({ ...newFabric, lengthCm: Number(e.target.value) })}
              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm block"
            />
          </label>
          <button onClick={handleAddFabricConfirm} className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm">
            追加
          </button>
          <button onClick={() => setAddingFabric(false)} className="px-3 py-1.5 rounded border border-gray-300 text-sm">
            キャンセル
          </button>
        </div>
      )}

      {activeFabric && (
        <div className="bg-white rounded-lg border border-gray-200 p-2.5 flex flex-wrap items-end gap-3 text-xs text-gray-600">
          <label className="space-y-1">
            <span>生地名</span>
            <input
              value={activeFabric.name}
              onChange={(e) => onUpdateFabric(activeFabric.id, { name: e.target.value })}
              className="w-28 border border-gray-300 rounded px-2 py-1 text-sm block"
            />
          </label>
          <label className="space-y-1">
            <span>幅 (cm)</span>
            <input
              type="number"
              value={activeFabric.widthCm}
              onChange={(e) => onUpdateFabric(activeFabric.id, { widthCm: Number(e.target.value) })}
              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm block"
            />
          </label>
          <label className="space-y-1">
            <span>長さ (cm)</span>
            <input
              type="number"
              value={activeFabric.lengthCm}
              onChange={(e) => onUpdateFabric(activeFabric.id, { lengthCm: Number(e.target.value) })}
              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm block"
            />
          </label>
          <label className="space-y-1">
            <span>色</span>
            <input
              type="color"
              value={activeFabric.color}
              onChange={(e) => onUpdateFabric(activeFabric.id, { color: e.target.value })}
              className="w-14 h-8 border border-gray-300 rounded block"
            />
          </label>
          <button onClick={handleDeleteFabric} className="px-2.5 py-1.5 rounded border border-gray-300 hover:bg-red-50 text-red-600">
            この生地を削除
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 bg-white rounded-lg border border-gray-200 p-2.5">
        <div className="flex items-center gap-1.5">
          <span>ズーム</span>
          <button onClick={() => setPxPerCm((z) => Math.max(1, z - 1))} className="px-2 py-0.5 rounded border border-gray-300">
            -
          </button>
          <span className="w-10 text-center">{pxPerCm}px/cm</span>
          <button onClick={() => setPxPerCm((z) => Math.min(10, z + 1))} className="px-2 py-0.5 rounded border border-gray-300">
            +
          </button>
        </div>
        <label className="flex items-center gap-1.5">
          <span>スナップ</span>
          <select value={snapCm} onChange={(e) => setSnapCm(Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1">
            {SNAP_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? "なし" : `${s}cm`}
              </option>
            ))}
          </select>
        </label>

        {selectedPlacement && (
          <>
            <span className="w-px h-5 bg-gray-200" />
            <span className="text-gray-500">選択中: {pieces.find((p) => p.id === selectedPlacement.pieceId)?.name ?? "?"}</span>
            <button onClick={() => onUpdatePlacement(selectedPlacement.id, { rotation: selectedPlacement.rotation - 90 })} className="px-2 py-1 rounded border border-gray-300">
              ↺90°
            </button>
            <button onClick={() => onUpdatePlacement(selectedPlacement.id, { rotation: selectedPlacement.rotation + 90 })} className="px-2 py-1 rounded border border-gray-300">
              ↻90°
            </button>
            <button onClick={() => onUpdatePlacement(selectedPlacement.id, { mirrored: !selectedPlacement.mirrored })} className="px-2 py-1 rounded border border-gray-300">
              ミラー
            </button>
            <button onClick={() => onDuplicatePlacement(selectedPlacement.id)} className="px-2 py-1 rounded border border-gray-300">
              複製
            </button>
            <button
              onClick={() => {
                onDeletePlacement(selectedPlacement.id);
                setSelectedId(null);
              }}
              className="px-2 py-1 rounded border border-gray-300 text-red-600"
            >
              削除
            </button>
            <label className="flex items-center gap-1">
              <span>X</span>
              <input
                type="number"
                value={Math.round(selectedPlacement.x * 10) / 10}
                onChange={(e) => onUpdatePlacement(selectedPlacement.id, { x: Number(e.target.value) })}
                className="w-16 border border-gray-300 rounded px-1 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1">
              <span>Y</span>
              <input
                type="number"
                value={Math.round(selectedPlacement.y * 10) / 10}
                onChange={(e) => onUpdatePlacement(selectedPlacement.id, { y: Number(e.target.value) })}
                className="w-16 border border-gray-300 rounded px-1 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1">
              <span>回転°</span>
              <input
                type="number"
                value={Math.round(selectedPlacement.rotation)}
                onChange={(e) => onUpdatePlacement(selectedPlacement.id, { rotation: Number(e.target.value) })}
                className="w-16 border border-gray-300 rounded px-1 py-0.5"
              />
            </label>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-[200px_1fr_220px] gap-3 items-start">
        <div className="bg-white rounded-lg border border-gray-200 p-2.5 space-y-1.5 max-h-[65vh] overflow-auto">
          <div className="text-xs font-semibold text-gray-600 mb-1">型紙を配置</div>
          {pieces.length === 0 && <p className="text-xs text-gray-400">「型紙」タブで先に型紙を作成してください。</p>}
          {pieces.map((piece) => {
            const placedCount = placements.filter((p) => p.pieceId === piece.id).length;
            return (
              <div key={piece.id} className="flex items-center justify-between gap-1 text-xs border border-gray-100 rounded px-2 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: piece.color }} />
                  <div className="min-w-0">
                    <div className="truncate text-gray-800">{piece.name}</div>
                    <div className={`text-[10px] ${placedCount >= piece.quantity ? "text-green-600" : "text-gray-400"}`}>
                      {placedCount}/{piece.quantity}
                    </div>
                  </div>
                </div>
                <button onClick={() => addPieceInstance(piece)} className="px-2 py-1 rounded bg-brand-600 text-white shrink-0">
                  追加
                </button>
              </div>
            );
          })}
        </div>

        <div className="border border-gray-300 rounded bg-gray-100 overflow-auto" style={{ maxHeight: "65vh" }}>
          {activeFabric && (
            <svg
              ref={svgRef}
              width={activeFabric.widthCm * pxPerCm}
              height={activeFabric.lengthCm * pxPerCm}
              viewBox={`0 0 ${activeFabric.widthCm} ${activeFabric.lengthCm}`}
              onPointerDown={() => setSelectedId(null)}
              style={{ display: "block" }}
            >
              <rect x={0} y={0} width={activeFabric.widthCm} height={activeFabric.lengthCm} fill={activeFabric.color || "#ffffff"} stroke="#9ca3af" strokeWidth={0.4} />
              {Array.from({ length: Math.floor(activeFabric.widthCm / 10) + 1 }, (_, i) => i * 10).map((g) => (
                <line key={`v${g}`} x1={g} y1={0} x2={g} y2={activeFabric.lengthCm} stroke={g % 50 === 0 ? "#cbd5e1" : "#e5e7eb"} strokeWidth={g % 50 === 0 ? 0.25 : 0.12} />
              ))}
              {Array.from({ length: Math.floor(activeFabric.lengthCm / 10) + 1 }, (_, i) => i * 10).map((g) => (
                <line key={`h${g}`} x1={0} y1={g} x2={activeFabric.widthCm} y2={g} stroke={g % 50 === 0 ? "#cbd5e1" : "#e5e7eb"} strokeWidth={g % 50 === 0 ? 0.25 : 0.12} />
              ))}

              {placementsOnActive.map((pl) => {
                const piece = pieces.find((p) => p.id === pl.pieceId);
                if (!piece) return null;
                const pts = transformPolygon(piece.points, pl);
                const outOfBounds = !polygonWithinBounds(pts, activeFabric.widthCm, activeFabric.lengthCm);
                const overlap = overlapPairIds.has(pl.id);
                const selected = pl.id === selectedId;
                const strokeColor = overlap ? "#dc2626" : outOfBounds ? "#f59e0b" : selected ? "#1d4ed8" : piece.color;

                const c0 = centroid(piece.points);
                const bbox = boundingBox(piece.points);
                const grainLen = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 0.35;
                const grainSegment = [
                  { x: c0.x, y: c0.y - grainLen },
                  { x: c0.x, y: c0.y + grainLen },
                ];
                const grainPts = transformPolygon(grainSegment, { x: pl.x, y: pl.y, rotation: pl.rotation + piece.grainAngle, mirrored: pl.mirrored });
                const label = centroid(pts);

                return (
                  <g
                    key={pl.id}
                    onPointerDown={(e) => handlePointerDown(e, pl)}
                    onPointerMove={(e) => handlePointerMove(e, pl)}
                    onPointerUp={handlePointerUp}
                    style={{ cursor: "grab", touchAction: "none" }}
                  >
                    <polygon points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill={piece.color + "66"} stroke={strokeColor} strokeWidth={selected ? 0.6 : 0.3} />
                    <line x1={grainPts[0].x} y1={grainPts[0].y} x2={grainPts[1].x} y2={grainPts[1].y} stroke="#374151" strokeWidth={0.15} strokeDasharray="1.2,0.8" />
                    <text x={label.x} y={label.y} fontSize={Math.max(2.2, grainLen * 0.18)} textAnchor="middle" fill="#111827" style={{ pointerEvents: "none", userSelect: "none" }}>
                      {piece.name}
                      {pl.mirrored ? "(反転)" : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2 text-xs">
          <div className="font-semibold text-gray-700">統計</div>
          {activeFabric && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">生地面積</span>
                <span>
                  {((activeFabric.widthCm * activeFabric.lengthCm) / 10000).toFixed(2)} m²
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">使用面積</span>
                <span>{((usedAreaByFabric.get(activeFabric.id) ?? 0) / 10000).toFixed(2)} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">生地効率</span>
                <span className="font-semibold">
                  {activeFabric.widthCm * activeFabric.lengthCm > 0
                    ? (((usedAreaByFabric.get(activeFabric.id) ?? 0) / (activeFabric.widthCm * activeFabric.lengthCm)) * 100).toFixed(1)
                    : "0"}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">配置数</span>
                <span>{placementsOnActive.length}</span>
              </div>
              {overlapPairIds.size > 0 && <div className="text-red-600">⚠ 重なりのある型紙があります</div>}
            </>
          )}
          <div className="pt-2 border-t border-gray-100">
            <button onClick={exportSvg} className="w-full px-2 py-1.5 rounded bg-brand-600 text-white">
              現在の生地をSVG出力
            </button>
          </div>
          <div className="pt-2 border-t border-gray-100 text-gray-400 leading-relaxed">
            <div className="font-medium text-gray-500 mb-1">ショートカット</div>
            R: 回転15° / Shift+R: 逆回転
            <br />
            M: ミラー / D: 複製 / Delete: 削除
            <br />
            矢印キー: 移動
          </div>
        </div>
      </div>
    </div>
  );
}
