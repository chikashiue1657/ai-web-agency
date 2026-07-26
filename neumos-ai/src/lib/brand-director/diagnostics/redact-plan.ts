/**
 * 診断ルートのレスポンスへBrandPlanを含める前に、写真URLの生値を
 * 位置ベースのラベル（photo#1等）へ置き換える。role/qualityScore/rejectionReasonは
 * そのまま返すため、Visionの判断内容そのものは確認できる。
 */
import type { BrandPlan } from "../types";

export function redactPlanPhotoUrls(plan: BrandPlan): BrandPlan {
  return {
    ...plan,
    photoAssignments: plan.photoAssignments.map((assignment, i) => ({
      ...assignment,
      photoUrl: `photo#${i + 1}`,
    })),
  };
}
