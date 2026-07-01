/**
 * 生成種別ディスパッチャ。将来 landing_page / instagram_post 等を実装する際は
 * ここへハンドラを追加するだけで済むように設計する（呼び出し側は変更不要）。
 */
import type { GenerationMethod, GenerationType, StoreBrief, GeneratedWebsiteContents } from "@/lib/types";
import { isGenerationTypeImplemented } from "@/lib/types";
import { generateWebsiteContents } from "@/lib/engine/website";

export class GenerationTypeNotImplementedError extends Error {
  constructor(public readonly generationType: GenerationType) {
    super(`generationType "${generationType}" is not implemented in Neumos AI v1 yet`);
    this.name = "GenerationTypeNotImplementedError";
  }
}

export interface EngineResult {
  contents: GeneratedWebsiteContents;
  method: GenerationMethod;
}

export async function runGeneration(generationType: GenerationType, brief: StoreBrief): Promise<EngineResult> {
  if (!isGenerationTypeImplemented(generationType)) {
    throw new GenerationTypeNotImplementedError(generationType);
  }

  switch (generationType) {
    case "website":
      return generateWebsiteContents(brief);
    default:
      // 型上は到達不能（isGenerationTypeImplemented で弾かれる）。将来の拡張漏れを検出する。
      throw new GenerationTypeNotImplementedError(generationType);
  }
}
