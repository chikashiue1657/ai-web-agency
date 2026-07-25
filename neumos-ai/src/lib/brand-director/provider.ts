/**
 * BrandDirectionProvider — 新規レイヤーのprovider抽象化。
 *
 * 既存の ContentGeneration 経路（engine/website.ts が rule/LLM で
 * GeneratedWebsiteContents を作る、LLM_PROVIDER=anthropic|openai）とは
 * 完全に独立した、別軸のprovider切替。今回はこの層自体がどの生成経路からも
 * 呼ばれていないため、事実上「常にオフ」なFeature Flagとして安全に追加できる。
 *
 * BRAND_DIRECTOR_PROVIDER=openai かつ OPENAI_API_KEY が設定されている場合のみ
 * OpenAI実装を使う。それ以外は常にrule実装（LLM不要・決定論的）へ安全に
 * フォールバックする。
 */
import type { BrandDirectionInput, BrandDirectionResult, PhotoAnalysis } from "./types";
import { ruleBrandDirectionProvider } from "./rule-provider";
import { openaiBrandDirectionProvider } from "./openai-provider";

export interface BrandDirectionProvider {
  readonly name: "rule" | "openai";
  /**
   * ブランド方針を決定する。`photoAnalyses`（Vision分析済みの結果）を渡すと、
   * その内容を踏まえてphotoAssignmentsを決める。渡さない場合はphotoAssignmentsは
   * 空配列を返す（写真を見ずに役割を捏造しないため）。
   */
  analyzeBrand(input: BrandDirectionInput, photoAnalyses?: PhotoAnalysis[]): Promise<BrandDirectionResult>;
  /** 写真URL配列を受け取り、1枚ずつ構造化された分析結果を返す。 */
  analyzePhotos(photoUrls: string[], input: BrandDirectionInput): Promise<PhotoAnalysis[]>;
}

export function isBrandDirectorOpenAiConfigured(): boolean {
  return process.env.BRAND_DIRECTOR_PROVIDER === "openai" && !!process.env.OPENAI_API_KEY;
}

export function getBrandDirectionProvider(): BrandDirectionProvider {
  return isBrandDirectorOpenAiConfigured() ? openaiBrandDirectionProvider : ruleBrandDirectionProvider;
}
