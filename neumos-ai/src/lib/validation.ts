import { z } from "zod";

/**
 * 入力検証。`brief` は AI集客支援MVP側 `NeumosBrief` をそのまま渡しても動くように、
 * 未知フィールド（例: brief.generationType の重複）は無視する（strictにしない）。
 */
/**
 * 危険なスキーム（javascript:/data:等）を拒否する安全なURL用スキーマ。
 * websiteUrlは実店舗サイトがhttp運用のケースも実データとして許容する
 * （ホストは店舗ごとに異なるため制限しない）。
 */
function safeUrlSchema(allowedProtocols: readonly string[]) {
  return z.string().refine(
    (value) => {
      try {
        return allowedProtocols.includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: `URL must use one of: ${allowedProtocols.join(", ")}` }
  );
}

const WebsiteUrlSchema = safeUrlSchema(["https:", "http:"]);

/**
 * このリポジトリ内で実際に確認できるgoogleMapsUriの取得形式（MVP側の
 * fixture・テスト・normalize/url.tsのNON_WEBSITE_HOSTS判定）は、いずれも
 * "maps.google.com"のみである。推測で他ドメイン（www.google.com/google.com等）
 * を広く許可せず、実際に確認できた形式だけに限定する。
 */
const ALLOWED_GOOGLE_MAPS_HOSTS = new Set(["maps.google.com"]);

/**
 * googleMapsUrlはGoogle Places由来のURLのみを想定するため、httpsに加えて
 * ホストをALLOWED_GOOGLE_MAPS_HOSTSへ限定し、user:password@形式の認証情報付き
 * URLも拒否する。ホストの一致は完全一致のみ（endsWith等のサフィックス一致は
 * "maps.google.com.evil.example"のような偽装ホストを通してしまうため使わない）。
 * 認証情報チェックにより"https://maps.google.com@evil.example/"
 * （実際のホストはevil.example）・"https://user:password@maps.google.com/"の
 * どちらも拒否する。
 */
const GoogleMapsUrlSchema = z.string().refine(
  (value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return false;
      if (url.username || url.password) return false;
      return ALLOWED_GOOGLE_MAPS_HOSTS.has(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  },
  { message: "googleMapsUrl must be an https URL on an allowed Google Maps host without embedded credentials" }
);

/** Googleビジネスプロフィール等から取得できた実データ（任意、無ければ全て省略可）。 */
export const StoreRealDataSchema = z.object({
  address: z.string().optional(),
  phone: z.string().optional(),
  openingHours: z.array(z.string()).optional(),
  closedDays: z.string().optional(),
  instagramUrl: z.string().optional(),
  googleRating: z.number().optional(),
  googleReviewCount: z.number().optional(),
  photoUrls: z.array(z.string()).optional(),
  menuItems: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  websiteUrl: WebsiteUrlSchema.optional(),
  googleMapsUrl: GoogleMapsUrlSchema.optional(),
});

export const StoreBriefSchema = z.object({
  storeName: z.string().min(1, "storeName is required"),
  industry: z.string().min(1, "industry is required"),
  area: z.string().min(1, "area is required"),
  targetCustomer: z.string().min(1, "targetCustomer is required"),
  mainProblem: z.string().min(1, "mainProblem is required"),
  salesAngle: z.string().min(1, "salesAngle is required"),
  websiteGoal: z.string().min(1, "websiteGoal is required"),
  siteConcept: z.string().min(1, "siteConcept is required"),
  recommendedPages: z.array(z.string()).default([]),
  seoKeywords: z.array(z.string()).default([]),
  tone: z.string().min(1, "tone is required"),
  offer: z.string().min(1, "offer is required"),
  realData: StoreRealDataSchema.optional(),
});

export const GenerationTypeSchema = z.enum([
  "website",
  "landing_page",
  "instagram_post",
  "google_business_improvement",
  "blog_post",
  "faq",
  "seo_content",
  "copywriting",
]);

export const GenerateRequestSchema = z.object({
  generationType: GenerationTypeSchema,
  brief: StoreBriefSchema,
});

export type ValidatedGenerateRequest = z.infer<typeof GenerateRequestSchema>;

/** LLM生成結果の検証用スキーマ。壊れたJSONが来た場合はルールベースにフォールバックする。 */
export const GeneratedWebsiteContentsSchema = z.object({
  concept: z.string().min(1),
  heroTitle: z.string().min(1),
  heroSubtitle: z.string().min(1),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["about", "service", "feature", "other"]),
        heading: z.string().min(1),
        body: z.string().min(1),
      })
    )
    .min(1),
  gallery: z
    .array(
      z.object({
        id: z.string().min(1),
        caption: z.string().min(1),
        altText: z.string().min(1),
      })
    )
    .min(1),
  access: z.object({
    areaLabel: z.string().min(1),
    addressHint: z.string().min(1),
    mapQuery: z.string().min(1),
  }),
  // contactMethods/cta.hrefは実際に機能するリンク（tel:/https://等）かどうかを
  // brief.realDataの有無で厳密に決める必要があるため、LLMにはシンプルな
  // ラベル文字列だけを出力させ、`engine/real-data-links.ts`のapplyRealDataLinksが
  // 生成方式に依らず必ず上書きする（ここではプレースホルダーの形だけ整える）。
  contactMethods: z
    .array(z.string().min(1))
    .min(1)
    .transform((labels) => labels.map((label) => ({ label }))),
  cta: z
    .object({
      headline: z.string().min(1),
      body: z.string().min(1),
      buttonLabel: z.string().min(1),
    })
    .transform((cta) => ({ ...cta, href: "#contact" })),
  seoTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  faq: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      })
    )
    .min(1),
  instagramCaption: z.string().min(1),
  googleBusinessImprovement: z.array(z.string().min(1)).min(1),
  strategy: z.object({
    strengths: z.array(z.string()),
    challenges: z.array(z.string()),
    targetPersona: z.string().min(1),
    differentiators: z.array(z.string()),
  }),
}).refine(
  (contents) => {
    const kinds = new Set(contents.sections.map((s) => s.kind));
    return kinds.has("about") && kinds.has("service") && kinds.has("feature");
  },
  { message: "sections must include at least one each of about/service/feature (required by Website Renderer)" }
);
