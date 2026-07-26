/**
 * POST /api/admin/brand-director/analyze の入力検証。
 *
 * 診断ルートは管理者が手入力する小さなダミーbriefを想定しているため、既存の
 * StoreBriefSchema（MVP側の任意入力をそのまま受けるため上限を設けていない）とは
 * 別に、文字列長・配列件数の上限を明示したstrictなスキーマを用意する
 * （.strict()により未知フィールドは拒否する）。
 *
 * 写真URLはこの診断ルートでは受け付けない。任意の外部URLをそのまま受け付けると、
 * 診断トークン漏洩時に第三者URLをOpenAIへ送信できてしまうため、初回の実API疎通
 * では写真なしのBrandPlan生成のみに限定する（photoUrlフィールド自体が存在しない
 * ため、指定すると.strict()により unknown field として拒否される）。
 */
import { z } from "zod";

const shortString = z.string().trim().min(1).max(100);
const mediumString = z.string().trim().min(1).max(500);

export const DiagnosticBriefOverrideSchema = z
  .object({
    storeName: shortString.optional(),
    industry: shortString.optional(),
    area: shortString.optional(),
    targetCustomer: shortString.optional(),
    mainProblem: mediumString.optional(),
    salesAngle: mediumString.optional(),
    websiteGoal: mediumString.optional(),
    siteConcept: mediumString.optional(),
    recommendedPages: z.array(shortString).max(10).optional(),
    seoKeywords: z.array(shortString).max(20).optional(),
    tone: shortString.optional(),
    offer: shortString.optional(),
  })
  .strict();

export const DiagnosticRequestBodySchema = z
  .object({
    brief: DiagnosticBriefOverrideSchema.optional(),
  })
  .strict();

/** リクエストbody全体の上限（バイト）。JSON.parse前に生テキストの長さで判定する。 */
export const MAX_DIAGNOSTIC_BODY_BYTES = 20_000;
