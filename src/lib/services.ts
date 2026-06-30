/**
 * サービス層（業務ユースケースのオーケストレーション）。
 * - normalize / scoring / proposal / site の純関数を repo・activityログと結合。
 * - API route と server action の双方から再利用できる薄いユースケース関数群。
 * - 副作用（保存・ログ）はここに集約し、純関数はテスト容易に保つ。
 */
import type { StoreSource, LeadStatus } from "@/lib/types";
import { getRepo } from "@/lib/repo";
import { normalizeBySource } from "@/lib/normalize";
import { scoreByRules, type ScoringInput } from "@/lib/scoring";
import { adjustScoreWithLlm } from "@/lib/scoring/llm";
import { buildProposal, type BuildProposalInput } from "@/lib/proposal";
import { refineProposalWithLlm } from "@/lib/proposal/llm";
import { buildSite, type BuildSiteInput } from "@/lib/site";
import { logger } from "@/lib/logger";

// ------------------------------------------------------------
// 取り込み（正規化 + upsert + ログ）
// ------------------------------------------------------------
export async function ingestStores(source: StoreSource, items: unknown[]) {
  const repo = getRepo();
  const normalized = items.map((item) => normalizeBySource(source, item));
  const result = await repo.upsertStores(normalized);
  // 取り込みログ（店舗単位）
  await Promise.all(
    result.stores.map((s) =>
      repo.logActivity(s.id, "store.ingested", { source, name: s.name })
    )
  );
  logger.info("stores ingested", {
    source,
    inserted: result.inserted,
    updated: result.updated,
  });
  return result;
}

// ------------------------------------------------------------
// 優先度判定（ルール → 任意でLLM補正 → 保存 → ログ）
// ------------------------------------------------------------
export async function scoreStore(storeId: string, opts?: { useLlm?: boolean; extra?: Partial<ScoringInput> }) {
  const repo = getRepo();
  const store = await repo.getStore(storeId);
  if (!store) throw new ServiceError("store_not_found", `store ${storeId} not found`, 404);

  const input: ScoringInput = {
    category: store.category,
    rating: store.rating,
    review_count: store.review_count,
    photo_count: store.photo_count,
    has_website: store.has_website,
    instagram_url: store.instagram_url,
    facebook_url: store.facebook_url,
    area: store.area,
    opening_hours: store.opening_hours,
    ...opts?.extra,
  };

  let result = scoreByRules(input);
  if (opts?.useLlm !== false) {
    result = await adjustScoreWithLlm(input, result);
  }

  const lead = await repo.saveLead({
    store_id: storeId,
    priority_rank: result.priority_rank,
    score: result.score,
    reasons: result.reasons,
    sales_angle: result.sales_angle,
    risk_flags: result.risk_flags,
  });
  await repo.logActivity(storeId, "lead.scored", {
    priority_rank: result.priority_rank,
    score: result.score,
    method: result.method,
  });
  return { lead, result };
}

// ------------------------------------------------------------
// 提案書生成（テンプレ → 任意でLLM磨き → 保存 → ログ）
// ------------------------------------------------------------
export async function generateProposal(
  storeId: string,
  opts?: {
    useLlm?: boolean;
    review_summary?: string | null;
    target_audience?: string | null;
  }
) {
  const repo = getRepo();
  const detail = await repo.getStoreDetail(storeId);
  if (!detail) throw new ServiceError("store_not_found", `store ${storeId} not found`, 404);
  const { store, lead } = detail;

  const input: BuildProposalInput = {
    store,
    scoring: lead
      ? { priority_rank: lead.priority_rank!, score: lead.score!, sales_angle: lead.sales_angle ?? "" }
      : null,
    review_summary: opts?.review_summary ?? null,
    target_audience: opts?.target_audience ?? null,
  };

  let proposal = buildProposal(input);
  if (opts?.useLlm !== false) {
    proposal = await refineProposalWithLlm(proposal, input);
  }

  const saved = await repo.saveProposal({ store_id: storeId, ...proposal });
  await repo.logActivity(storeId, "proposal.generated", { proposal_id: saved.id });
  return saved;
}

// ------------------------------------------------------------
// 仮デモサイト生成（純関数 → slug衝突回避 → 保存 → ログ）
// ------------------------------------------------------------
export async function generateSite(
  storeId: string,
  opts?: Pick<BuildSiteInput, "theme" | "language" | "review_summary" | "menu_items">
) {
  const repo = getRepo();
  const store = await repo.getStore(storeId);
  if (!store) throw new ServiceError("store_not_found", `store ${storeId} not found`, 404);

  const existingSlugs = new Set(await repo.listSlugs());
  const { slug, document } = buildSite({
    store,
    existingSlugs,
    theme: opts?.theme,
    language: opts?.language,
    review_summary: opts?.review_summary ?? null,
    menu_items: opts?.menu_items,
  });

  const saved = await repo.saveSite({
    store_id: storeId,
    slug,
    theme_type: document.themeType,
    language: document.language,
    generated_json: document,
  });
  await repo.logActivity(storeId, "site.generated", { slug, theme: document.themeType });
  return saved;
}

// ------------------------------------------------------------
// 営業メモ・ステータス更新
// ------------------------------------------------------------
export async function updateNotes(storeId: string, notes: string) {
  const repo = getRepo();
  const lead = await repo.updateLeadNotes(storeId, notes);
  await repo.logActivity(storeId, "lead.note_updated", {});
  return lead;
}

export async function updateStatus(storeId: string, status: LeadStatus, contactMethod?: string) {
  const repo = getRepo();
  const lead = await repo.updateLeadStatus(storeId, status, contactMethod);
  await repo.logActivity(storeId, "lead.status_updated", { status });
  return lead;
}

/** API層で扱いやすいよう、HTTPステータス付きの業務エラー。 */
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
