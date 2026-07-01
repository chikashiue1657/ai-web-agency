/**
 * インメモリ Repository 実装。
 * - Supabase未設定時の既定実装。ダミーデータをシードして起動即デモ可能。
 * - データはプロセス内に保持（再起動で消える）。MVPの開発/デモ/テスト用。
 * - upsert は place_id 優先、無ければ name+address の近似一致で重複統合。
 */
import { randomUUID } from "node:crypto";
import type {
  Store,
  Lead,
  Proposal,
  GeneratedSite,
  ActivityLog,
  NormalizedStore,
  LeadStatus,
  ActivityEventType,
  SiteGenerationRequest,
} from "@/lib/types";
import { similarity } from "@/lib/normalize/helpers";
import { DEFAULT_LEAD_STATUS, isContactStatus } from "@/lib/status";
import {
  seedStores,
  seedLeads,
  seedProposals,
  seedSites,
  seedActivityLogs,
} from "@/lib/mock/data";
import type {
  Repository,
  StoreWithLead,
  StoreListFilters,
  StoreDetail,
  DashboardStats,
  SaveLeadInput,
  SaveProposalInput,
  SaveSiteInput,
  UpsertResult,
  CreateSiteRequestInput,
} from "./types";

/** 近似一致のしきい値（name+address 連結） */
const MATCH_THRESHOLD = 0.82;

class MemoryRepository implements Repository {
  private stores: Store[] = structuredClone(seedStores);
  private leads: Lead[] = structuredClone(seedLeads);
  private proposals: Proposal[] = structuredClone(seedProposals);
  private sites: GeneratedSite[] = structuredClone(seedSites);
  private siteRequests: SiteGenerationRequest[] = [];
  private logs: ActivityLog[] = structuredClone(seedActivityLogs);

  async listStores(filters: StoreListFilters = {}): Promise<StoreWithLead[]> {
    let rows = this.stores.map((s) => this.attach(s));

    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.address ?? "").toLowerCase().includes(q)
      );
    }
    if (filters.category) rows = rows.filter((r) => r.category === filters.category);
    if (filters.area) rows = rows.filter((r) => r.area === filters.area);
    if (filters.hasWebsite !== undefined)
      rows = rows.filter((r) => r.has_website === filters.hasWebsite);
    if (filters.priority)
      rows = rows.filter((r) => r.lead?.priority_rank === filters.priority);
    if (filters.status) rows = rows.filter((r) => r.lead?.status === filters.status);

    rows.sort(this.sorter(filters.sort));
    return rows;
  }

  private sorter(sort?: StoreListFilters["sort"]) {
    return (a: StoreWithLead, b: StoreWithLead) => {
      switch (sort) {
        case "score_asc":
          return (a.lead?.score ?? -1) - (b.lead?.score ?? -1);
        case "name_asc":
          return a.name.localeCompare(b.name, "ja");
        case "created_desc":
          return b.created_at.localeCompare(a.created_at);
        case "score_desc":
        default:
          return (b.lead?.score ?? -1) - (a.lead?.score ?? -1);
      }
    };
  }

  private attach(s: Store): StoreWithLead {
    const lead = this.leads.find((l) => l.store_id === s.id) ?? null;
    return {
      ...s,
      lead: lead
        ? {
            priority_rank: lead.priority_rank,
            score: lead.score,
            status: lead.status,
            last_contacted_at: lead.last_contacted_at,
          }
        : null,
      has_proposal: this.proposals.some((p) => p.store_id === s.id),
      has_site: this.sites.some((g) => g.store_id === s.id),
    };
  }

  async getStore(id: string): Promise<Store | null> {
    return this.stores.find((s) => s.id === id) ?? null;
  }

  async getStoreDetail(id: string): Promise<StoreDetail | null> {
    const store = await this.getStore(id);
    if (!store) return null;
    return {
      store,
      lead: this.leads.find((l) => l.store_id === id) ?? null,
      proposals: this.proposals
        .filter((p) => p.store_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      sites: this.sites
        .filter((g) => g.store_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      activity: this.logs
        .filter((l) => l.store_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      siteRequests: this.siteRequests
        .filter((r) => r.store_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  }

  /** place_id 優先 → name+address 近似一致 で既存を探す。 */
  private findExisting(n: NormalizedStore): Store | undefined {
    if (n.place_id) {
      const byPlace = this.stores.find((s) => s.place_id && s.place_id === n.place_id);
      if (byPlace) return byPlace;
    }
    const key = `${n.name} ${n.address ?? ""}`;
    let best: { store: Store; sim: number } | null = null;
    for (const s of this.stores) {
      // place_id 同士が両方あって不一致なら別店舗とみなす
      if (n.place_id && s.place_id && s.place_id !== n.place_id) continue;
      const sim = similarity(key, `${s.name} ${s.address ?? ""}`);
      if (!best || sim > best.sim) best = { store: s, sim };
    }
    return best && best.sim >= MATCH_THRESHOLD ? best.store : undefined;
  }

  async upsertStores(input: NormalizedStore[]): Promise<UpsertResult> {
    let inserted = 0;
    let updated = 0;
    const affected: Store[] = [];
    const ts = new Date().toISOString();

    for (const n of input) {
      const existing = this.findExisting(n);
      if (existing) {
        Object.assign(existing, n, { updated_at: ts });
        updated++;
        affected.push(existing);
      } else {
        const store: Store = {
          ...n,
          id: randomUUID(),
          tenant_id: null,
          created_at: ts,
          updated_at: ts,
        };
        this.stores.push(store);
        inserted++;
        affected.push(store);
      }
    }
    return { inserted, updated, stores: affected };
  }

  async saveLead(input: SaveLeadInput): Promise<Lead> {
    const ts = new Date().toISOString();
    const existing = this.leads.find((l) => l.store_id === input.store_id);
    if (existing) {
      Object.assign(existing, {
        priority_rank: input.priority_rank,
        score: input.score,
        reasons: input.reasons,
        sales_angle: input.sales_angle,
        risk_flags: input.risk_flags,
        updated_at: ts,
      });
      return existing;
    }
    const lead: Lead = {
      id: randomUUID(),
      store_id: input.store_id,
      priority_rank: input.priority_rank,
      score: input.score,
      reasons: input.reasons,
      sales_angle: input.sales_angle,
      risk_flags: input.risk_flags,
      status: DEFAULT_LEAD_STATUS,
      contact_method: null,
      last_contacted_at: null,
      notes: null,
      created_at: ts,
      updated_at: ts,
    };
    this.leads.push(lead);
    return lead;
  }

  async updateLeadNotes(storeId: string, notes: string): Promise<Lead | null> {
    const lead = this.leads.find((l) => l.store_id === storeId);
    if (!lead) return null;
    lead.notes = notes;
    lead.updated_at = new Date().toISOString();
    return lead;
  }

  async updateLeadStatus(
    storeId: string,
    status: LeadStatus,
    contactMethod?: string
  ): Promise<Lead | null> {
    const lead = this.leads.find((l) => l.store_id === storeId);
    if (!lead) return null;
    lead.status = status;
    if (contactMethod) lead.contact_method = contactMethod;
    if (isContactStatus(status)) lead.last_contacted_at = new Date().toISOString();
    lead.updated_at = new Date().toISOString();
    return lead;
  }

  async saveProposal(input: SaveProposalInput): Promise<Proposal> {
    const proposal: Proposal = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...input,
    };
    this.proposals.push(proposal);
    return proposal;
  }

  async saveSite(input: SaveSiteInput): Promise<GeneratedSite> {
    const ts = new Date().toISOString();
    const site: GeneratedSite = {
      id: randomUUID(),
      store_id: input.store_id,
      slug: input.slug,
      theme_type: input.theme_type,
      language: input.language,
      generated_json: input.generated_json,
      published_url: null,
      status: "preview",
      created_at: ts,
      updated_at: ts,
    };
    this.sites.push(site);
    return site;
  }

  async getSiteBySlug(slug: string): Promise<GeneratedSite | null> {
    return this.sites.find((s) => s.slug === slug) ?? null;
  }

  async listSlugs(): Promise<string[]> {
    return this.sites.map((s) => s.slug);
  }

  async createSiteGenerationRequest(
    input: CreateSiteRequestInput
  ): Promise<SiteGenerationRequest> {
    const ts = new Date().toISOString();
    const req: SiteGenerationRequest = {
      id: randomUUID(),
      store_id: input.store_id,
      provider: input.provider,
      generation_type: input.generation_type,
      status: input.status,
      brief: input.brief,
      external_id: input.external_id ?? null,
      preview_url: input.preview_url ?? null,
      published_url: null,
      error: input.error ?? null,
      created_at: ts,
      updated_at: ts,
    };
    this.siteRequests.push(req);
    return req;
  }

  async listSiteGenerationRequests(storeId: string): Promise<SiteGenerationRequest[]> {
    return this.siteRequests
      .filter((r) => r.store_id === storeId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async logActivity(
    storeId: string | null,
    eventType: ActivityEventType,
    payload?: Record<string, unknown>
  ): Promise<ActivityLog> {
    const log: ActivityLog = {
      id: randomUUID(),
      store_id: storeId,
      event_type: eventType,
      payload: payload ?? null,
      created_at: new Date().toISOString(),
    };
    this.logs.push(log);
    return log;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: this.stores.length,
      rankA: this.leads.filter((l) => l.priority_rank === "A").length,
      rankB: this.leads.filter((l) => l.priority_rank === "B").length,
      rankC: this.leads.filter((l) => l.priority_rank === "C").length,
      noWebsite: this.stores.filter((s) => !s.has_website).length,
      newThisWeek: this.stores.filter(
        (s) => new Date(s.created_at).getTime() >= weekAgo
      ).length,
      proposalsGenerated: new Set(this.proposals.map((p) => p.store_id)).size,
    };
  }
}

/** プロセス内シングルトン（HMRでも保持されるよう globalThis に退避）。 */
const g = globalThis as unknown as { __memRepo?: MemoryRepository };
export function getMemoryRepository(): Repository {
  if (!g.__memRepo) g.__memRepo = new MemoryRepository();
  return g.__memRepo;
}
