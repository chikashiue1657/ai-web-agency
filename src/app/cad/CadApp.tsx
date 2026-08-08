"use client";

/**
 * 衣料品レイアウトCAD — トップレベル状態管理。
 * 型紙定義（PieceEditor）と生地配置（LayoutBoard）の2タブ構成。
 * サーバ保存はせず、localStorageのみで完結する個人用ツール。
 */
import { useEffect, useRef, useState } from "react";
import PieceEditor from "./PieceEditor";
import LayoutBoard from "./LayoutBoard";
import { downloadBlob } from "@/lib/cad/download";
import { uid } from "@/lib/cad/id";
import {
  createEmptyProject,
  deleteNamedProject,
  listSavedProjects,
  loadCurrentProject,
  saveCurrentProject,
  saveNamedProject,
} from "@/lib/cad/storage";
import type { CadProject, Fabric, PatternPiece, Placement, SavedProjectSummary } from "@/lib/cad/types";

type Tab = "pieces" | "layout";

function isCadProject(value: unknown): value is CadProject {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.fabrics) && Array.isArray(v.pieces) && Array.isArray(v.placements) && typeof v.name === "string";
}

export default function CadApp() {
  const [project, setProject] = useState<CadProject>(() => createEmptyProject());
  const [tab, setTab] = useState<Tab>("pieces");
  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [showManage, setShowManage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const saved = loadCurrentProject();
    if (saved) setProject(saved);
    setSavedProjects(listSavedProjects());
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    const timer = setTimeout(() => saveCurrentProject(project), 400);
    return () => clearTimeout(timer);
  }, [project]);

  function touch(updater: (p: CadProject) => CadProject) {
    setProject((prev) => ({ ...updater(prev), updatedAt: new Date().toISOString() }));
  }

  // --- 型紙 ---
  function addPiece(piece: PatternPiece) {
    touch((p) => ({ ...p, pieces: [...p.pieces, piece] }));
  }
  function updatePiece(id: string, patch: Partial<PatternPiece>) {
    touch((p) => ({ ...p, pieces: p.pieces.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }
  function deletePiece(id: string) {
    touch((p) => ({
      ...p,
      pieces: p.pieces.filter((it) => it.id !== id),
      placements: p.placements.filter((pl) => pl.pieceId !== id),
    }));
  }

  // --- 生地 ---
  function addFabric(fabric: Fabric) {
    touch((p) => ({ ...p, fabrics: [...p.fabrics, fabric] }));
  }
  function updateFabric(id: string, patch: Partial<Fabric>) {
    touch((p) => ({ ...p, fabrics: p.fabrics.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  }
  function deleteFabric(id: string) {
    touch((p) => ({
      ...p,
      fabrics: p.fabrics.filter((f) => f.id !== id),
      placements: p.placements.filter((pl) => pl.fabricId !== id),
    }));
  }

  // --- 配置 ---
  function addPlacement(placement: Placement) {
    touch((p) => ({ ...p, placements: [...p.placements, placement] }));
  }
  function updatePlacement(id: string, patch: Partial<Placement>) {
    touch((p) => ({ ...p, placements: p.placements.map((pl) => (pl.id === id ? { ...pl, ...patch } : pl)) }));
  }
  function deletePlacement(id: string) {
    touch((p) => ({ ...p, placements: p.placements.filter((pl) => pl.id !== id) }));
  }
  function duplicatePlacement(id: string) {
    touch((p) => {
      const src = p.placements.find((pl) => pl.id === id);
      if (!src) return p;
      const copy: Placement = { ...src, id: uid("place"), x: src.x + 5, y: src.y + 5 };
      return { ...p, placements: [...p.placements, copy] };
    });
  }

  // --- プロジェクト管理 ---
  function handleNewProject() {
    if (!window.confirm("現在の作業内容を破棄して新規プロジェクトを作成しますか？")) return;
    setProject(createEmptyProject());
  }

  function handleSaveAs() {
    const name = window.prompt("保存名を入力してください", project.name);
    if (!name) return;
    const saved = saveNamedProject({ ...project, name });
    setProject(saved);
    setSavedProjects(listSavedProjects());
  }

  function handleOpen(id: string) {
    if (!id) return;
    const found = savedProjects.find((s) => s.id === id);
    if (!found) return;
    const loaded = window.localStorage.getItem(`clothing-cad:project:${id}`);
    if (!loaded) return;
    try {
      const parsed = JSON.parse(loaded) as CadProject;
      setProject(parsed);
    } catch {
      window.alert("読み込みに失敗しました");
    }
  }

  function handleDeleteSaved(id: string) {
    if (!window.confirm("この保存済みプロジェクトを削除しますか？")) return;
    deleteNamedProject(id);
    setSavedProjects(listSavedProjects());
  }

  function handleExportJson() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${project.name || "cad-project"}.json`);
  }

  function handleImportJsonClick() {
    fileInputRef.current?.click();
  }

  async function handleImportJsonChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isCadProject(parsed)) throw new Error("invalid");
      setProject(parsed);
    } catch {
      window.alert("JSONの読み込みに失敗しました。ファイル形式を確認してください。");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold mr-2">衣料品レイアウトCAD</h1>
          <input
            value={project.name}
            onChange={(e) => touch((p) => ({ ...p, name: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1 text-sm w-48"
            aria-label="プロジェクト名"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-sm">
          <button onClick={handleNewProject} className="px-2.5 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
            新規
          </button>
          <button onClick={handleSaveAs} className="px-2.5 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
            名前を付けて保存
          </button>
          <button
            onClick={() => setShowManage((v) => !v)}
            className="px-2.5 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
          >
            開く / 管理（{savedProjects.length}）
          </button>
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={handleExportJson} className="px-2.5 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
            JSONエクスポート
          </button>
          <button onClick={handleImportJsonClick} className="px-2.5 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
            JSONインポート
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportJsonChange} />
        </div>
      </div>

      <p className="text-xs text-gray-400">自動保存: ブラウザのlocalStorageに保存されます（このブラウザ・この端末限定）。別端末に移す場合はJSONエクスポートを利用してください。</p>

      {showManage && (
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
          <div className="font-semibold text-gray-700 mb-2">保存済みプロジェクト</div>
          {savedProjects.length === 0 ? (
            <p className="text-gray-400 text-xs">まだありません。「名前を付けて保存」で追加できます。</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {savedProjects.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <span className="text-gray-800">{s.name}</span>
                    <span className="text-gray-400 text-xs ml-2">{new Date(s.updatedAt).toLocaleString("ja-JP")}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        handleOpen(s.id);
                        setShowManage(false);
                      }}
                      className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-xs"
                    >
                      開く
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(s.id)}
                      className="px-2 py-1 rounded border border-gray-300 hover:bg-red-50 text-red-600 text-xs"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab("pieces")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "pieces" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          型紙（{project.pieces.length}）
        </button>
        <button
          onClick={() => setTab("layout")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "layout" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          レイアウト配置
        </button>
      </div>

      {tab === "pieces" ? (
        <PieceEditor pieces={project.pieces} onAdd={addPiece} onUpdate={updatePiece} onDelete={deletePiece} />
      ) : (
        <LayoutBoard
          fabrics={project.fabrics}
          pieces={project.pieces}
          placements={project.placements}
          onAddFabric={addFabric}
          onUpdateFabric={updateFabric}
          onDeleteFabric={deleteFabric}
          onAddPlacement={addPlacement}
          onUpdatePlacement={updatePlacement}
          onDeletePlacement={deletePlacement}
          onDuplicatePlacement={duplicatePlacement}
        />
      )}
    </div>
  );
}
