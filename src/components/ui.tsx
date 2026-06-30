/**
 * 管理画面向けの軽量UI部品（派手にせず実務的に）。
 * 業務ロジックを持たない純粋な表示コンポーネント。
 */
import Link from "next/link";
import type { PriorityRank, LeadStatus } from "@/lib/types";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

const RANK_STYLE: Record<PriorityRank, string> = {
  A: "bg-red-100 text-red-700",
  B: "bg-amber-100 text-amber-700",
  C: "bg-gray-100 text-gray-600",
};

export function PriorityBadge({ rank }: { rank?: PriorityRank | null }) {
  if (!rank) return <span className="text-gray-300 text-xs">未判定</span>;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${RANK_STYLE[rank]}`}>
      {rank}
    </span>
  );
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "新規",
  contacted: "接触済み",
  in_progress: "商談中",
  won: "受注",
  lost: "失注",
  on_hold: "保留",
};

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-purple-100 text-purple-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-gray-200 text-gray-600",
  on_hold: "bg-yellow-100 text-yellow-700",
};

export function StatusBadge({ status }: { status?: LeadStatus | null }) {
  if (!status) return <span className="text-gray-300 text-xs">-</span>;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="text-green-600 text-sm">あり</span>
  ) : (
    <span className="text-gray-400 text-sm">なし</span>
  );
}

export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-brand-600 hover:underline">
      ← {children}
    </Link>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "飲食店",
  cafe: "カフェ",
  izakaya: "居酒屋",
  beauty: "美容",
  clinic: "医療",
  hotel: "宿泊",
  retail: "小売",
  other: "その他",
};

export function categoryLabel(c: string | null | undefined): string {
  if (!c) return "-";
  return CATEGORY_LABEL[c] ?? c;
}
