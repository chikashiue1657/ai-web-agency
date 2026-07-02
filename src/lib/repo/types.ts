/**
 * Repository層の共通型。
 * 業務ロジック/UIはこの抽象だけに依存し、保存先(Supabase/インメモリ)を差し替え可能にする。
 */
import type {
  Store,
  Lead,
  Proposal,
  GeneratedSite,
  ActivityLog,
  NormalizedStore,
  PriorityRank,
  LeadStatus,
  ActivityEventType,
  SiteDocument,
  ContentGenerationRequest,
  NeumosBrief,
  ContentGenStatus,
  GenerationType,
  StoreStrategy,
  GeneratedContent,
} from "@/lib/types";

/** 一覧表示用：店舗＋リード概要 */
export interface StoreWithLead extends Store {
  lead: Pick<
    Lead,
    "priority_rank" | "score" | "status" | "last_contacted_at"
  > | null;
  has_proposal: boolean;
  has_site: boolean;
}

/** 一覧フィルタ */
export interface StoreListFilters {
  q?: string; // フリーワード（店名/住所）
  category?: string;
  area?: string;
  priority?: PriorityRank;
  hasWebsite?: boolean;
  status?: LeadStatus;
  sort?: "score_desc" | "score_asc" | "created_desc" | "name_asc";
}

/** 詳細表示用：店舗の全関連データ */
export interface StoreDetail {
  store: Store;
  lead: Lead | null;
  proposals: Proposal[];
  sites: GeneratedSite[];
  activity: ActivityLog[];
  strategy: StoreStrategy | null; // Thinking Engine の診断結果（1:1）
  contentRequests: ContentGenerationRequest[]; // ノイモスAIコンテンツ生成の記録
}

/** ダッシュボード集計 */
export interface DashboardStats {
  total: number;
  rankA: number;
  rankB: number;
  rankC: number;
  noWebsite: number;
  newThisWeek: number;
  proposalsGenerated: number;
}

export interface SaveLeadInput {
  store_id: string;
  priority_rank: PriorityRank;
  score: number;
  reasons: string[];
  sales_angle: string;
  risk_flags: string[];
}

export interface SaveProposalInput {
  store_id: string;
  summary: string;
  problems: string[];
  opportunities: string[];
  suggested_sections: string[];
  sales_message: string;
  generated_markdown: string;
}

export interface SaveSiteInput {
  store_id: string;
  slug: string;
  theme_type: string;
  language: string;
  generated_json: SiteDocument;
}

export interface CreateContentRequestInput {
  store_id: string;
  provider: string;
  generation_type: GenerationType;
  status: ContentGenStatus;
  brief: NeumosBrief | null;
  external_id?: string | null;
  preview_url?: string | null;
  published_url?: string | null;
  generated_contents?: GeneratedContent[] | null;
  error?: string | null;
}

/** 生成状況ポーリング等での部分更新 */
export interface UpdateContentRequestPatch {
  status?: ContentGenStatus;
  external_id?: string | null;
  preview_url?: string | null;
  published_url?: string | null;
  generated_contents?: GeneratedContent[] | null;
  error?: string | null;
}

/** StoreStrategy の保存入力（id/timestampはDB採番） */
export type SaveStrategyInput = Omit<
  StoreStrategy,
  "id" | "created_at" | "updated_at"
>;

/** 取り込み結果サマリ */
export interface UpsertResult {
  inserted: number;
  updated: number;
  stores: Store[];
}

export interface Repository {
  // stores
  listStores(filters?: StoreListFilters): Promise<StoreWithLead[]>;
  getStore(id: string): Promise<Store | null>;
  getStoreDetail(id: string): Promise<StoreDetail | null>;
  upsertStores(stores: NormalizedStore[]): Promise<UpsertResult>;
  // leads
  saveLead(input: SaveLeadInput): Promise<Lead>;
  updateLeadNotes(storeId: string, notes: string): Promise<Lead | null>;
  updateLeadStatus(
    storeId: string,
    status: LeadStatus,
    contactMethod?: string
  ): Promise<Lead | null>;
  // proposals
  saveProposal(input: SaveProposalInput): Promise<Proposal>;
  // sites
  saveSite(input: SaveSiteInput): Promise<GeneratedSite>;
  getSiteBySlug(slug: string): Promise<GeneratedSite | null>;
  listSlugs(): Promise<string[]>;
  // store strategies（Thinking Engine 診断結果, store と 1:1）
  saveStoreStrategy(input: SaveStrategyInput): Promise<StoreStrategy>;
  getStoreStrategy(storeId: string): Promise<StoreStrategy | null>;
  // content generation requests（ノイモスAI連携: 受注→生成→公開の記録）
  createContentGenerationRequest(
    input: CreateContentRequestInput
  ): Promise<ContentGenerationRequest>;
  listContentGenerationRequests(storeId: string): Promise<ContentGenerationRequest[]>;
  getContentGenerationRequest(id: string): Promise<ContentGenerationRequest | null>;
  updateContentGenerationRequest(
    id: string,
    patch: UpdateContentRequestPatch
  ): Promise<ContentGenerationRequest | null>;
  // activity
  logActivity(
    storeId: string | null,
    eventType: ActivityEventType,
    payload?: Record<string, unknown>
  ): Promise<ActivityLog>;
  // dashboard
  getDashboardStats(): Promise<DashboardStats>;
}
