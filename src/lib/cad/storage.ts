/**
 * 衣料品パターンレイアウトCAD — localStorage永続化。
 * 個人利用ツールのためサーバ保存は行わず、ブラウザのlocalStorageのみで完結させる。
 * すべてクライアント専用（window未定義時は何もしない/nullを返す）。
 */
import { uid } from "./id";
import type { CadProject, SavedProjectSummary } from "./types";

const CURRENT_KEY = "clothing-cad:current";
const PROJECT_INDEX_KEY = "clothing-cad:projects";
const PROJECT_PREFIX = "clothing-cad:project:";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function createEmptyProject(name = "新規プロジェクト"): CadProject {
  return {
    id: uid("proj"),
    name,
    fabrics: [
      {
        id: uid("fabric"),
        name: "表地",
        widthCm: 150,
        lengthCm: 200,
        color: "#ffffff",
      },
    ],
    pieces: [],
    placements: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadCurrentProject(): CadProject | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CadProject;
  } catch {
    return null;
  }
}

export function saveCurrentProject(project: CadProject): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(CURRENT_KEY, JSON.stringify(project));
  } catch {
    // ストレージ容量超過等は個人ツールのため無視（エクスポートで手動退避可能）
  }
}

export function listSavedProjects(): SavedProjectSummary[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(PROJECT_INDEX_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedProjectSummary[];
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function writeIndex(list: SavedProjectSummary[]): void {
  window.localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(list));
}

export function saveNamedProject(project: CadProject): CadProject {
  const saved: CadProject = { ...project, updatedAt: new Date().toISOString() };
  if (!hasWindow()) return saved;
  window.localStorage.setItem(PROJECT_PREFIX + saved.id, JSON.stringify(saved));
  const index = listSavedProjects().filter((p) => p.id !== saved.id);
  index.push({ id: saved.id, name: saved.name, updatedAt: saved.updatedAt });
  writeIndex(index);
  return saved;
}

export function loadNamedProject(id: string): CadProject | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(PROJECT_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as CadProject;
  } catch {
    return null;
  }
}

export function deleteNamedProject(id: string): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(PROJECT_PREFIX + id);
  writeIndex(listSavedProjects().filter((p) => p.id !== id));
}
