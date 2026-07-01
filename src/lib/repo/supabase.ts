/**
 * Supabase Repository 実装。
 * - service role クライアントでサーバ側からアクセス。
 * - upsert は place_id 一意制約を活用。place_id 無しは取得済み候補とJS近似一致で統合。
 */
import type {
  Store,
  Lead,
  Proposal,
  GeneratedSite,
  ActivityLog,
  NormalizedStore,
  LeadStatus,
  ActivityEventType,
  ContentGenerationRequest,
  StoreStrategy,
} from "@/lib/types";
import { similarity } from "@/lib/normalize/helpers";
import { isContactStatus } from "@/lib/status";
import { getSupabaseAdmin } from "@/lib/supabase/server";
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
  CreateContentRequestInput,
  UpdateContentRequestPatch,
  SaveStrategyInput,
} from "./types";

const MATCH_THRESHOLD = 0.82;

/** store_strategies の行形（戦略本体は data(jsonb) に格納） */
interface StrategyRow {
  id: string;
  store_id: string;
  data: Omit<StoreStrategy, "id" | "created_at" | "updated_at">;
  created_at: string;
  updated_at: string;
}

/** DB行 → StoreStrategy へ復元 */
function rowToStrategy(row: StrategyRow): StoreStrategy {
  return {
    ...row.data,
    id: row.id,
    storeId: row.store_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function db() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase client not configured");
  return client;
}

class SupabaseRepository implements Repository {
  async listStores(filters: StoreListFilters = {}): Promise<StoreWithLead[]> {
    let query = db().from("stores").select("*");
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.area) query = query.eq("area", filters.area);
    if (filters.hasWebsite !== undefined)
      query = query.eq("has_website", filters.hasWebsite);
    if (filters.q) query = query.or(`name.ilike.%${filters.q}%,address.ilike.%${filters.q}%`);

    const { data: stores, error } = await query;
    if (error) throw error;
    const storeRows = (stores ?? []) as Store[];
    const ids = storeRows.map((s) => s.id);

    const [{ data: leads }, { data: props }, { data: sites }] = await Promise.all([
      db().from("leads").select("*").in("store_id", ids.length ? ids : ["_none"]),
      db().from("proposals").select("store_id").in("store_id", ids.length ? ids : ["_none"]),
      db().from("generated_sites").select("store_id").in("store_id", ids.length ? ids : ["_none"]),
    ]);

    const leadMap = new Map((leads ?? []).map((l: Lead) => [l.store_id, l]));
    const propSet = new Set((props ?? []).map((p: { store_id: string }) => p.store_id));
    const siteSet = new Set((sites ?? []).map((s: { store_id: string }) => s.store_id));

    let rows: StoreWithLead[] = storeRows.map((s) => {
      const lead = leadMap.get(s.id);
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
        has_proposal: propSet.has(s.id),
        has_site: siteSet.has(s.id),
      };
    });

    // lead由来フィルタはJS側で（join制約を避けるため）
    if (filters.priority) rows = rows.filter((r) => r.lead?.priority_rank === filters.priority);
    if (filters.status) rows = rows.filter((r) => r.lead?.status === filters.status);

    rows.sort((a, b) => {
      switch (filters.sort) {
        case "score_asc":
          return (a.lead?.score ?? -1) - (b.lead?.score ?? -1);
        case "name_asc":
          return a.name.localeCompare(b.name, "ja");
        case "created_desc":
          return b.created_at.localeCompare(a.created_at);
        default:
          return (b.lead?.score ?? -1) - (a.lead?.score ?? -1);
      }
    });
    return rows;
  }

  async getStore(id: string): Promise<Store | null> {
    const { data, error } = await db().from("stores").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as Store) ?? null;
  }

  async getStoreDetail(id: string): Promise<StoreDetail | null> {
    const store = await this.getStore(id);
    if (!store) return null;
    const [{ data: lead }, { data: proposals }, { data: sites }, { data: activity }, { data: strategyRow }, { data: contentRequests }] =
      await Promise.all([
        db().from("leads").select("*").eq("store_id", id).maybeSingle(),
        db().from("proposals").select("*").eq("store_id", id).order("created_at", { ascending: false }),
        db().from("generated_sites").select("*").eq("store_id", id).order("created_at", { ascending: false }),
        db().from("activity_logs").select("*").eq("store_id", id).order("created_at", { ascending: false }),
        db().from("store_strategies").select("*").eq("store_id", id).maybeSingle(),
        db().from("content_generation_requests").select("*").eq("store_id", id).order("created_at", { ascending: false }),
      ]);
    return {
      store,
      lead: (lead as Lead) ?? null,
      proposals: (proposals as Proposal[]) ?? [],
      sites: (sites as GeneratedSite[]) ?? [],
      activity: (activity as ActivityLog[]) ?? [],
      strategy: strategyRow ? rowToStrategy(strategyRow as StrategyRow) : null,
      contentRequests: (contentRequests as ContentGenerationRequest[]) ?? [],
    };
  }

  async upsertStores(input: NormalizedStore[]): Promise<UpsertResult> {
    let inserted = 0;
    let updated = 0;
    const affected: Store[] = [];

    for (const n of input) {
      let existing: Store | null = null;

      if (n.place_id) {
        const { data } = await db()
          .from("stores")
          .select("*")
          .eq("place_id", n.place_id)
          .maybeSingle();
        existing = (data as Store) ?? null;
      }
      if (!existing) {
        // name の前方一致で候補を絞り、JS近似一致
        const { data: candidates } = await db()
          .from("stores")
          .select("*")
          .ilike("name", `%${n.name.slice(0, 4)}%`)
          .limit(20);
        const key = `${n.name} ${n.address ?? ""}`;
        for (const c of (candidates as Store[]) ?? []) {
          if (n.place_id && c.place_id && c.place_id !== n.place_id) continue;
          if (similarity(key, `${c.name} ${c.address ?? ""}`) >= MATCH_THRESHOLD) {
            existing = c;
            break;
          }
        }
      }

      if (existing) {
        const { data, error } = await db()
          .from("stores")
          .update(n)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        updated++;
        affected.push(data as Store);
      } else {
        const { data, error } = await db().from("stores").insert(n).select("*").single();
        if (error) throw error;
        inserted++;
        affected.push(data as Store);
      }
    }
    return { inserted, updated, stores: affected };
  }

  async saveLead(input: SaveLeadInput): Promise<Lead> {
    const { data, error } = await db()
      .from("leads")
      .upsert(
        {
          store_id: input.store_id,
          priority_rank: input.priority_rank,
          score: input.score,
          reasons: input.reasons,
          sales_angle: input.sales_angle,
          risk_flags: input.risk_flags,
        },
        { onConflict: "store_id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    return data as Lead;
  }

  async updateLeadNotes(storeId: string, notes: string): Promise<Lead | null> {
    const { data, error } = await db()
      .from("leads")
      .update({ notes })
      .eq("store_id", storeId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return (data as Lead) ?? null;
  }

  async updateLeadStatus(
    storeId: string,
    status: LeadStatus,
    contactMethod?: string
  ): Promise<Lead | null> {
    const patch: Record<string, unknown> = { status };
    if (contactMethod) patch.contact_method = contactMethod;
    if (isContactStatus(status)) patch.last_contacted_at = new Date().toISOString();
    const { data, error } = await db()
      .from("leads")
      .update(patch)
      .eq("store_id", storeId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return (data as Lead) ?? null;
  }

  async saveProposal(input: SaveProposalInput): Promise<Proposal> {
    const { data, error } = await db().from("proposals").insert(input).select("*").single();
    if (error) throw error;
    return data as Proposal;
  }

  async saveSite(input: SaveSiteInput): Promise<GeneratedSite> {
    const { data, error } = await db()
      .from("generated_sites")
      .insert({
        store_id: input.store_id,
        slug: input.slug,
        theme_type: input.theme_type,
        language: input.language,
        generated_json: input.generated_json,
        status: "preview",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as GeneratedSite;
  }

  async getSiteBySlug(slug: string): Promise<GeneratedSite | null> {
    const { data, error } = await db()
      .from("generated_sites")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return (data as GeneratedSite) ?? null;
  }

  async listSlugs(): Promise<string[]> {
    const { data, error } = await db().from("generated_sites").select("slug");
    if (error) throw error;
    return (data ?? []).map((r: { slug: string }) => r.slug);
  }

  async saveStoreStrategy(input: SaveStrategyInput): Promise<StoreStrategy> {
    // 可搬性のため戦略本体は data(jsonb) に格納。検索用に一部をカラム化。
    const { data, error } = await db()
      .from("store_strategies")
      .upsert(
        {
          store_id: input.storeId,
          confidence_score: input.confidenceScore,
          sales_angle: input.salesAngle,
          data: input,
        },
        { onConflict: "store_id" }
      )
      .select("*")
      .single();
    if (error) throw error;
    return rowToStrategy(data as StrategyRow);
  }

  async getStoreStrategy(storeId: string): Promise<StoreStrategy | null> {
    const { data, error } = await db()
      .from("store_strategies")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToStrategy(data as StrategyRow) : null;
  }

  async createContentGenerationRequest(
    input: CreateContentRequestInput
  ): Promise<ContentGenerationRequest> {
    const { data, error } = await db()
      .from("content_generation_requests")
      .insert({
        store_id: input.store_id,
        provider: input.provider,
        generation_type: input.generation_type,
        status: input.status,
        brief: input.brief,
        external_id: input.external_id ?? null,
        preview_url: input.preview_url ?? null,
        published_url: input.published_url ?? null,
        generated_contents: input.generated_contents ?? null,
        error: input.error ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as ContentGenerationRequest;
  }

  async listContentGenerationRequests(storeId: string): Promise<ContentGenerationRequest[]> {
    const { data, error } = await db()
      .from("content_generation_requests")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as ContentGenerationRequest[]) ?? [];
  }

  async getContentGenerationRequest(id: string): Promise<ContentGenerationRequest | null> {
    const { data, error } = await db()
      .from("content_generation_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as ContentGenerationRequest) ?? null;
  }

  async updateContentGenerationRequest(
    id: string,
    patch: UpdateContentRequestPatch
  ): Promise<ContentGenerationRequest | null> {
    const { data, error } = await db()
      .from("content_generation_requests")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return (data as ContentGenerationRequest) ?? null;
  }

  async logActivity(
    storeId: string | null,
    eventType: ActivityEventType,
    payload?: Record<string, unknown>
  ): Promise<ActivityLog> {
    const { data, error } = await db()
      .from("activity_logs")
      .insert({ store_id: storeId, event_type: eventType, payload: payload ?? null })
      .select("*")
      .single();
    if (error) throw error;
    return data as ActivityLog;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const [stores, leads, proposals] = await Promise.all([
      db().from("stores").select("id, has_website, created_at"),
      db().from("leads").select("priority_rank"),
      db().from("proposals").select("store_id"),
    ]);
    const storeRows = (stores.data ?? []) as Array<{ has_website: boolean; created_at: string }>;
    const leadRows = (leads.data ?? []) as Array<{ priority_rank: string | null }>;
    const propRows = (proposals.data ?? []) as Array<{ store_id: string }>;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: storeRows.length,
      rankA: leadRows.filter((l) => l.priority_rank === "A").length,
      rankB: leadRows.filter((l) => l.priority_rank === "B").length,
      rankC: leadRows.filter((l) => l.priority_rank === "C").length,
      noWebsite: storeRows.filter((s) => !s.has_website).length,
      newThisWeek: storeRows.filter((s) => new Date(s.created_at).getTime() >= weekAgo).length,
      proposalsGenerated: new Set(propRows.map((p) => p.store_id)).size,
    };
  }
}

let cached: SupabaseRepository | null = null;
export function getSupabaseRepository(): Repository {
  if (!cached) cached = new SupabaseRepository();
  return cached;
}
