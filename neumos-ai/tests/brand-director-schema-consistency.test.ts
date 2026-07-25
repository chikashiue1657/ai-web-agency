/**
 * BrandPlan/PhotoAnalysisのzodスキーマとJSON Schema（OpenAI Responses API用）の
 * 数値・配列の上下限が食い違っていないことを検証する。
 *
 * schema.tsはBRAND_PLAN_BOUNDSを単一の真実源として両方から参照しているため、
 * 通常はこのテストが落ちることはない想定だが、将来どちらかが値を直書きして
 * 上書きしてしまう変更が入った場合に検知できるよう、実際にzodの内部表現(_def)と
 * JSON Schemaのプレーンオブジェクトを突き合わせる。
 *
 * 注意: z.number().min/max()の値は公開ゲッター(.minValue/.maxValue)で読めるが、
 * z.array().min/max()の値はこのzodバージョン(3.25.76)では公開ゲッターが
 * undefinedを返すため、_def.minLength.value / _def.maxLength.valueを直接読む。
 * zodのメジャーバージョンを上げた際はこの読み取り方法を見直すこと。
 */
import { describe, expect, it } from "vitest";
import {
  BRAND_PLAN_BOUNDS,
  BRAND_PLAN_JSON_SCHEMA,
  BrandPlanSchema,
  PHOTO_ANALYSIS_JSON_SCHEMA,
  PhotoAnalysisSchema,
} from "@/lib/brand-director/schema";

function arrayBounds(schema: { _def: { minLength?: { value: number } | null; maxLength?: { value: number } | null } }) {
  return { min: schema._def.minLength?.value, max: schema._def.maxLength?.value };
}

describe("BrandPlan: zod境界値とJSON Schema境界値の一致", () => {
  it("audiences: zodとJSON Schemaが一致する", () => {
    const zodBounds = arrayBounds(BrandPlanSchema.shape.audiences);
    expect(zodBounds).toEqual(BRAND_PLAN_BOUNDS.audiences);
    expect(BRAND_PLAN_JSON_SCHEMA.schema.properties.audiences.minItems).toBe(BRAND_PLAN_BOUNDS.audiences.min);
    expect(BRAND_PLAN_JSON_SCHEMA.schema.properties.audiences.maxItems).toBe(BRAND_PLAN_BOUNDS.audiences.max);
  });

  it("moodKeywords: zodとJSON Schemaが一致する", () => {
    const zodBounds = arrayBounds(BrandPlanSchema.shape.moodKeywords);
    expect(zodBounds).toEqual(BRAND_PLAN_BOUNDS.moodKeywords);
    expect(BRAND_PLAN_JSON_SCHEMA.schema.properties.moodKeywords.minItems).toBe(BRAND_PLAN_BOUNDS.moodKeywords.min);
    expect(BRAND_PLAN_JSON_SCHEMA.schema.properties.moodKeywords.maxItems).toBe(BRAND_PLAN_BOUNDS.moodKeywords.max);
  });

  it("photoAssignments: zodとJSON Schemaが一致する（上限のみ、下限は0）", () => {
    const zodBounds = arrayBounds(BrandPlanSchema.shape.photoAssignments);
    expect(zodBounds.max).toBe(BRAND_PLAN_BOUNDS.photoAssignments.max);
    expect(BRAND_PLAN_JSON_SCHEMA.schema.properties.photoAssignments.maxItems).toBe(
      BRAND_PLAN_BOUNDS.photoAssignments.max
    );
  });

  it("evidence: zodとJSON Schemaが一致する", () => {
    const zodBounds = arrayBounds(BrandPlanSchema.shape.evidence);
    expect(zodBounds).toEqual(BRAND_PLAN_BOUNDS.evidence);
    expect(BRAND_PLAN_JSON_SCHEMA.schema.properties.evidence.minItems).toBe(BRAND_PLAN_BOUNDS.evidence.min);
    expect(BRAND_PLAN_JSON_SCHEMA.schema.properties.evidence.maxItems).toBe(BRAND_PLAN_BOUNDS.evidence.max);
  });

  it("confidence: zodとJSON Schemaが一致する", () => {
    const numberSchema = BrandPlanSchema.shape.confidence;
    expect(numberSchema.minValue).toBe(BRAND_PLAN_BOUNDS.confidence.min);
    expect(numberSchema.maxValue).toBe(BRAND_PLAN_BOUNDS.confidence.max);
    expect(BRAND_PLAN_JSON_SCHEMA.schema.properties.confidence.minimum).toBe(BRAND_PLAN_BOUNDS.confidence.min);
    expect(BRAND_PLAN_JSON_SCHEMA.schema.properties.confidence.maximum).toBe(BRAND_PLAN_BOUNDS.confidence.max);
  });

  it("photoAssignments[].qualityScore: zodとJSON Schemaが一致する", () => {
    const photoAssignmentSchema = BrandPlanSchema.shape.photoAssignments.element;
    const numberSchema = photoAssignmentSchema.shape.qualityScore;
    expect(numberSchema.minValue).toBe(BRAND_PLAN_BOUNDS.qualityScore.min);
    expect(numberSchema.maxValue).toBe(BRAND_PLAN_BOUNDS.qualityScore.max);
    const jsonQualityScore = BRAND_PLAN_JSON_SCHEMA.schema.properties.photoAssignments.items.properties.qualityScore;
    expect(jsonQualityScore.minimum).toBe(BRAND_PLAN_BOUNDS.qualityScore.min);
    expect(jsonQualityScore.maximum).toBe(BRAND_PLAN_BOUNDS.qualityScore.max);
  });
});

describe("PhotoAnalysis: zod境界値とJSON Schema境界値の一致", () => {
  it("qualityScore: zodとJSON Schemaが一致する", () => {
    const numberSchema = PhotoAnalysisSchema.shape.qualityScore;
    expect(numberSchema.minValue).toBe(BRAND_PLAN_BOUNDS.qualityScore.min);
    expect(numberSchema.maxValue).toBe(BRAND_PLAN_BOUNDS.qualityScore.max);
    expect(PHOTO_ANALYSIS_JSON_SCHEMA.schema.properties.qualityScore.minimum).toBe(BRAND_PLAN_BOUNDS.qualityScore.min);
    expect(PHOTO_ANALYSIS_JSON_SCHEMA.schema.properties.qualityScore.maximum).toBe(BRAND_PLAN_BOUNDS.qualityScore.max);
  });
});

describe("JSON Schema (strict mode) の構造的整合性", () => {
  it("BRAND_PLAN_JSON_SCHEMA: 全プロパティがrequiredかつadditionalProperties:falseである", () => {
    const { schema } = BRAND_PLAN_JSON_SCHEMA;
    expect(schema.additionalProperties).toBe(false);
    expect(new Set(schema.required)).toEqual(new Set(Object.keys(schema.properties)));
  });

  it("PHOTO_ANALYSIS_JSON_SCHEMA: 全プロパティがrequiredかつadditionalProperties:falseである", () => {
    const { schema } = PHOTO_ANALYSIS_JSON_SCHEMA;
    expect(schema.additionalProperties).toBe(false);
    expect(new Set(schema.required)).toEqual(new Set(Object.keys(schema.properties)));
  });
});
