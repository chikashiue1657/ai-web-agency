/**
 * 仮デモサイトの JSON schema（Zod）。
 * - generated_json の検証・型保証に使用。
 * - types.ts の SiteDocument と整合させる（CMS化時の入出力契約）。
 */
import { z } from "zod";

export const SiteSectionSchema = z.object({
  type: z.enum([
    "hero",
    "about",
    "menu",
    "access",
    "faq",
    "contact",
    "gallery",
    "reviews",
  ]),
  heading: z.string(),
  body: z.string().optional(),
  items: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        meta: z.string().optional(),
      })
    )
    .optional(),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  isHypothesis: z.boolean().optional(),
});

export const SitePageSchema = z.object({
  slug: z.string(),
  title: z.string(),
  seo: z.object({ title: z.string(), description: z.string() }),
  sections: z.array(SiteSectionSchema),
});

export const SiteDocumentSchema = z.object({
  storeName: z.string(),
  themeType: z.string(),
  language: z.string(),
  brandColor: z.string(),
  pages: z.array(SitePageSchema),
  usedPhotoFallback: z.boolean(),
  generationNotes: z.array(z.string()),
});

export type SiteDocumentParsed = z.infer<typeof SiteDocumentSchema>;
