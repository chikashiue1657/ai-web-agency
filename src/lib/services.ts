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
import { ServiceError } from "@/lib/errors";
import { normalizePlacesNew } from "@/lib/normalize";
import { searchTextPlaces, type PlacesSearchOptions } from "@/lib/places/client";
import {
  buildOutreach,
  type OutreachChannel,
  type OutreachInput,
} from "@/lib/outreach";
import { refineOutreachWithLlm } from "@/lib/outreach/llm";

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
// Google Places API (New) 検索 → 正規化 → upsert（place_id重複は保存せず更新）
// ------------------------------------------------------------
export interface PlacesSearchIngestResult {
  query: string;
  found: number; // APIヒット件数
  inserted: number; // 新規保存件数
  updated: number; // 既存更新（place_id重複）件数
  scored: number; // 優先度判定を実行できた件数
  store_ids: string[];
}

export async function searchAndIngestPlaces(
  query: string,
  opts?: PlacesSearchOptions
): Promise<PlacesSearchIngestResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new ServiceError("invalid_query", "検索キーワードを入力してください", 400);
  }

  // 1) Places API (New) で検索
  const places = await searchTextPlaces(trimmed, opts);

  // 2) 正規化（source=google_places）
  const normalized = places
    .map((p) => normalizePlacesNew(p))
    // 保存キーとして place_id を必須にする（重複判定の要件を満たすため）
    .filter((n) => !!n.place_id);

  // 3) upsert（place_id 一致は insert せず update = 重複を保存しない）
  const repo = getRepo();
  const result = await repo.upsertStores(normalized);

  // 4) 取り込みログ（新規/更新の別も残す）
  await Promise.all(
    result.stores.map((s) =>
      repo.logActivity(s.id, "store.ingested", {
        source: "google_places",
        via: "places_api_new",
        query: trimmed,
        name: s.name,
      })
    )
  );

  // 5) 取得直後に自動でルールベースの優先度判定を実行。
  //    → 一覧に即 A/B/C・スコア・ステータス(新規)を表示できる。
  //    LLMは使わない（20件を高速・確実に。APIキー不要）。個別失敗は握りつぶす。
  const scoredResults = await Promise.all(
    result.stores.map((s) =>
      scoreStore(s.id, { useLlm: false }).then(
        () => true,
        (e) => {
          logger.warn("auto scoring failed", { store_id: s.id, error: String(e) });
          return false;
        }
      )
    )
  );
  const scored = scoredResults.filter(Boolean).length;

  logger.info("places searched & ingested", {
    query: trimmed,
    found: places.length,
    inserted: result.inserted,
    updated: result.updated,
    scored,
  });

  return {
    query: trimmed,
    found: places.length,
    inserted: result.inserted,
    updated: result.updated,
    scored,
    store_ids: result.stores.map((s) => s.id),
  };
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

// ------------------------------------------------------------
// アウトリーチ文面生成（④メール ⑤DM ⑥電話トーク）
//   純関数で下書き → 任意でLLM磨き → 活動ログ。文面はUIで表示/コピー。
// ------------------------------------------------------------
export async function generateOutreach(
  storeId: string,
  channel: OutreachChannel,
  opts?: { useLlm?: boolean }
): Promise<string> {
  const repo = getRepo();
  const detail = await repo.getStoreDetail(storeId);
  if (!detail) throw new ServiceError("store_not_found", `store ${storeId} not found`, 404);
  const { store, lead, proposals } = detail;

  const input: OutreachInput = {
    store,
    sales_angle: lead?.sales_angle ?? null,
    proposal_summary: proposals[0]?.summary ?? null,
  };

  let text = buildOutreach(channel, input);
  if (opts?.useLlm !== false) {
    text = await refineOutreachWithLlm(channel, text, store.name);
  }

  await repo.logActivity(storeId, "outreach.generated", { channel });
  return text;
}

// API層で扱いやすいHTTPステータス付き業務エラーは errors.ts に定義。
// 既存の import パス互換（@/lib/services から使う箇所）のため再エクスポートする。
export { ServiceError };
