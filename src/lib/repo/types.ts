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
  SiteGenerationRequest,
  SiteGenerationBrief,
  SiteGenRequestStatus,
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
  siteRequests: SiteGenerationRequest[]; // ノイモスAI本番サイト生成の記録
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

export interface CreateSiteRequestInput {
  store_id: string;
  provider: string;
  status: SiteGenRequestStatus;
  brief: SiteGenerationBrief;
  external_id?: string | null;
  preview_url?: string | null;
  error?: string | null;
}

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
  // site generation requests（ノイモスAI連携: 受注→生成→公開の記録）
  createSiteGenerationRequest(
    input: CreateSiteRequestInput
  ): Promise<SiteGenerationRequest>;
  listSiteGenerationRequests(storeId: string): Promise<SiteGenerationRequest[]>;
  // activity
  logActivity(
    storeId: string | null,
    eventType: ActivityEventType,
    payload?: Record<string, unknown>
  ): Promise<ActivityLog>;
  // dashboard
  getDashboardStats(): Promise<DashboardStats>;
}
