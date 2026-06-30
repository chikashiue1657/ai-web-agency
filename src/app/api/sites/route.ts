/**
 * POST /api/sites
 * 仮デモサイト生成API（JSON schemaベースのサイト構造を生成して保存）。
 *
 * body: { store_id: string, theme?: ThemeType, language?: string, review_summary?: string, menu_items?: [...] }
 */
import { handler, ok, parseBody, SiteSchema } from "@/lib/api";
import { generateSite } from "@/lib/services";

export const POST = handler(async (req) => {
  const body = await parseBody(req, SiteSchema);
  const site = await generateSite(body.store_id, {
    theme: body.theme,
    language: body.language,
    review_summary: body.review_summary,
    menu_items: body.menu_items,
  });
  return ok({ site, preview_path: `/preview/${site.slug}` }, 201);
});
