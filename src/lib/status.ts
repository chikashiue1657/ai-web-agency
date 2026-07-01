/**
 * 営業ステータス（ファネル）の単一定義。
 * UI・API・repo すべてがここを参照し、表記/順序/接触判定の重複を避ける。
 */
import type { LeadStatus } from "@/lib/types";

/** ファネル順（表示・遷移ボタンの並び） */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "todo",
  "dm_sent",
  "called",
  "negotiating",
  "won",
  "lost",
];

/** 日本語ラベル */
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  todo: "未対応",
  dm_sent: "DM送信",
  called: "電話",
  negotiating: "商談",
  won: "成約",
  lost: "失注",
};

/** バッジ配色（管理画面トーンに合わせる） */
export const LEAD_STATUS_STYLE: Record<LeadStatus, string> = {
  todo: "bg-gray-100 text-gray-600",
  dm_sent: "bg-blue-100 text-blue-700",
  called: "bg-indigo-100 text-indigo-700",
  negotiating: "bg-purple-100 text-purple-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-rose-100 text-rose-700",
};

/** 「接触済み」とみなすステータス（last_contacted_at を更新する対象） */
export const CONTACT_STATUSES: LeadStatus[] = ["dm_sent", "called", "negotiating"];

export function isContactStatus(status: LeadStatus): boolean {
  return CONTACT_STATUSES.includes(status);
}

/** 既定ステータス（新規リード） */
export const DEFAULT_LEAD_STATUS: LeadStatus = "todo";
