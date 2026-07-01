/**
 * 管理画面向けの軽量UI部品（派手にせず実務的に）。
 * 業務ロジックを持たない純粋な表示コンポーネント。
 */
import Link from "next/link";
import type { PriorityRank, LeadStatus } from "@/lib/types";
import { LEAD_STATUS_LABEL, LEAD_STATUS_STYLE } from "@/lib/status";

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

export function StatusBadge({ status }: { status?: LeadStatus | null }) {
  if (!status) return <span className="text-gray-300 text-xs">-</span>;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs ${LEAD_STATUS_STYLE[status]}`}>
      {LEAD_STATUS_LABEL[status]}
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
