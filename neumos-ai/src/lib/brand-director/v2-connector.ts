/**
 * v2生成経路（/preview/[requestId]/v2）専用の、Brand Directorへの小さな接続層。
 *
 * 既存のContentGeneration経路（generate.ts / engine/website.ts）・v1描画・
 * v2の既存デザインエンジン（theme-v2 / section-plan-v2 / photo-strategy /
 * section-rhythm-v2）は一切変更しない。ここではBrandPlanを取得し、
 * WebsiteRendererV2が安全に使える形（PhotoPlanの上書き候補）へ変換するだけを
 * 担当する。
 *
 * Brand Director呼び出し自体（getBrandDirectionProvider経由）は、モデル未設定・
 * タイムアウト・スキーマ不一致・HTTPエラーのいずれについても既にrule-provider
 * へ安全にフォールバックする設計（openai-provider.ts）だが、この接続層自体も
 * try/catchで二重に保護する。これにより、Brand Director関連で予期しない例外が
 * 発生してもv2ページの描画自体が失敗することはなく、BrandPlanを使わない
 * （＝現状と同じ）描画へ倒れる。
 */
import { classifyIndustry } from "@/lib/engine/industry";
import { classifyPhotoTier, type PhotoPlan } from "@/lib/engine/photo-strategy";
import type { StoreBrief } from "@/lib/types";
import { getBrandDirectionProvider } from "./provider";
import { redactErrorForLog } from "./redact";
import type { BrandPlan } from "./types";

/**
 * v2生成時のみBrand Directorを呼び出す（v2はカフェ業態のみ対応のため、
 * それ以外の業種で呼んでも使い道が無く、無駄なコスト・レイテンシになる）。
 * 失敗時は必ずundefinedを返す（＝BrandPlan無しで従来通り描画される）。
 */
export async function resolveBrandPlanForV2(brief: StoreBrief, requestId: string): Promise<BrandPlan | undefined> {
  if (classifyIndustry(brief.industry) !== "cafe") return undefined;

  try {
    const provider = getBrandDirectionProvider();
    const input = { requestId, brief };
    // Hero/Story/Galleryの判断に必要な先頭3枚だけを生成時に分析する。
    // v2表示時には再分析しないため、閲覧ごとのAPI費用は発生しない。
    const photoUrls = (brief.realData?.photoUrls ?? []).slice(0, 3);
    const photoAnalyses = photoUrls.length ? await provider.analyzePhotos(photoUrls, input) : undefined;
    const result = await provider.analyzeBrand(input, photoAnalyses);
    // usage情報（APIキー・プロンプト・写真URLの生値を含まない安全なフィールドのみ）を
    // 既存のusage-log境界（ログ出力）へ渡す。Supabaseへの永続化は今回のPRでは行わない。
    console.info("[neumos-ai] brand-director v2 usage", result.usage);
    return result.plan;
  } catch (err) {
    console.warn(
      "[neumos-ai] brand-director v2 connector failed; rendering without BrandPlan",
      redactErrorForLog(err)
    );
    return undefined;
  }
}

/**
 * BrandPlan.photoAssignmentsを、v2の既存PhotoPlan形状（buildPhotoPlanと同じ
 * 出力形）へ変換する。以下のいずれかに該当する場合は必ずundefinedを返し、
 * 呼び出し側で既存の位置ベースbuildPhotoPlan()へフォールバックさせる。
 *  - photoAssignmentsが空（Vision分析を接続していない現状、photoAnalysesを
 *    渡さずにOpenAIへ問い合わせた場合は、system prompt側の指示によりこの型は
 *    常に空配列で返る設計＝現状は常にこの分岐に入り、既存の見た目を変えない）
 *  - roleが"reject"以外の割当てが1件も無い
 *  - 1件でも、brief.realData.photoUrlsに実在しないURLを含む場合
 *    （BrandPlanが実在しない写真を作った可能性があるため、丸ごと信頼しない。
 *    実データを最優先し、存在しない情報を生成しないという方針を守るため）
 *
 * BrandPlan.photoAssignmentsはBRAND_PLAN_BOUNDS.photoAssignments.max（6枚）で
 * 上限が設けられているため、実際の写真が7枚以上ある店舗ではBrandPlanが
 * 言及していない写真が発生しうる。buildPhotoPlan()（既存・上限なし）から見て
 * 写真が減って見えることのないよう、BrandPlanが明示的に"reject"とした写真だけを
 * 除外し、言及されていない実写真はGalleryへそのまま残す（実データを優先し、
 * 内部の上限を理由に実在する写真を消さない）。
 */
export function derivePhotoPlanFromBrandPlan(brandPlan: BrandPlan, realPhotoUrls: string[]): PhotoPlan | undefined {
  const accepted = brandPlan.photoAssignments.filter((a) => a.role !== "reject");
  if (accepted.length === 0) return undefined;

  const realSet = new Set(realPhotoUrls);
  const allKnown = brandPlan.photoAssignments.every((a) => realSet.has(a.photoUrl));
  if (!allKnown) return undefined;

  const dedupedAccepted = Array.from(new Set(accepted.map((a) => a.photoUrl)));
  const heroPhotoUrl = accepted.find((a) => a.role === "hero")?.photoUrl ?? dedupedAccepted[0];
  const storyPhotoUrl = accepted.find((a) => a.role === "story" && a.photoUrl !== heroPhotoUrl)?.photoUrl;

  const mentionedUrls = new Set(brandPlan.photoAssignments.map((a) => a.photoUrl));
  const unmentionedRealUrls = realPhotoUrls.filter((url) => !mentionedUrls.has(url));
  const galleryPhotoUrls = Array.from(
    new Set([
      ...dedupedAccepted.filter((url) => url !== heroPhotoUrl && url !== storyPhotoUrl),
      ...unmentionedRealUrls,
    ])
  );

  const totalCount = new Set([heroPhotoUrl, storyPhotoUrl, ...galleryPhotoUrls].filter((u): u is string => !!u)).size;

  return {
    tier: classifyPhotoTier(totalCount),
    heroPhotoUrl,
    storyPhotoUrl,
    galleryPhotoUrls,
  };
}
