/**
 * 生成コピーの文字数制約。
 *
 * ルールベース生成はブリーフの文章（salesAngle/targetCustomer等）をそのまま
 * 連結すると簡単に長文化する（実例: ヒーローの見出しが90文字超になり、
 * スマホは元よりPC表示でも折り返しだらけになっていた）。LLM生成でも
 * プロンプトの目安文字数を超えて出力されることがあるため、
 * どちらの生成方式でも同じ上限が最終的に効くよう、この関数を
 * ルールベース生成（rule-based.ts）とLLM出力の正規化（website.ts）の
 * 両方から共通で使う。
 */
import type { GeneratedWebsiteContents, StoreBrief, WebsiteSection } from "@/lib/types";

/** ヒーローの見出し。大きいフォントで2〜3行に収まる目安。 */
export const HERO_TITLE_MAX = 36;
/** ヒーローの補足コピー。1〜3行に収まる目安。 */
export const HERO_SUBTITLE_MAX = 70;
/** 本文（コンセプト・セクション本文・CTA本文等）の目安上限。 */
export const BODY_MAX = 150;

/**
 * 括弧書きの補足（例: brief.targetCustomerに含まれる「（仮説：要ヒアリングで確定）」
 * のような社内向けのメモ書き）を取り除く。
 *
 * 注意: これは「独立した1つの生フィールド」に対してのみ使うこと。
 * buildConcept等が組み立てる文はテンプレート自身が構造的に「（…）」で
 * 一節を囲むため、既に合成済みの文へこの関数を適用すると、テンプレートの
 * 外側の括弧とbrief由来の内側の括弧が入れ子になり、誤った範囲を
 * 削ってしまう（実際に発生した不具合）。そのため sanitizeBrief で
 * 合成前の生フィールドに対してのみ適用する。
 */
export function stripAsides(text: string): string {
  return text
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * brief中の自由記述フィールドから括弧書きの補足（社内向けメモ等）を取り除いた
 * コピーを返す。生成のどの経路（ルールベース／LLM）でも、まずこれを通した
 * briefを使うことで、内部向けの注記が公開ページに漏れるのを防ぐ。
 */
export function sanitizeBrief(brief: StoreBrief): StoreBrief {
  return {
    ...brief,
    targetCustomer: stripAsides(brief.targetCustomer),
    salesAngle: stripAsides(brief.salesAngle),
    mainProblem: stripAsides(brief.mainProblem),
    offer: stripAsides(brief.offer),
    siteConcept: stripAsides(brief.siteConcept),
    tone: stripAsides(brief.tone),
  };
}

/**
 * 日本語の文章を自然な位置（。→、→スペースの順）で上限文字数以内に丸める。
 * 良い切れ目が見つからない場合のみ、末尾を省略記号にして強制的に切る。
 */
export function truncateJa(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;

  const slice = trimmed.slice(0, maxLen);
  for (const boundary of ["。", "、", " ", "／", "/"]) {
    const idx = slice.lastIndexOf(boundary);
    // 上限の半分未満の位置で切ると内容が痩せすぎるため、それより後ろの区切りだけ採用する
    if (idx >= maxLen * 0.5) {
      return boundary === "。" ? slice.slice(0, idx + 1) : slice.slice(0, idx) + "…";
    }
  }
  return slice.slice(0, maxLen - 1) + "…";
}

/**
 * ハイフンを含む英字の店名（例: "BB-Coffee"）がヒーロー見出しの折り返しで
 * 「BB-」/「Coffee」のように分断される不具合があった（`break-keep`は
 * CJK文字の単語内改行は防ぐが、ハイフンは依然として改行可能点として
 * 扱われるため）。半角ハイフンを改行不可のハイフン（U+2011）に置き換え、
 * 見た目は変えずに店名の途中で折り返されないようにする。
 */
export function preventAwkwardBreaks(text: string): string {
  return text.replace(/-/g, "‑");
}

function clampSection(section: WebsiteSection): WebsiteSection {
  return { ...section, body: truncateJa(section.body, BODY_MAX) };
}

/**
 * 生成方式（ルールベース／LLM）によらず、公開ページに表示される文字数を
 * 一貫した上限に揃える最終正規化。LLMが目安文字数を超えて出力した場合の
 * セーフティネットとしても使う。
 */
export function clampGeneratedContents(contents: GeneratedWebsiteContents): GeneratedWebsiteContents {
  return {
    ...contents,
    heroTitle: preventAwkwardBreaks(truncateJa(contents.heroTitle, HERO_TITLE_MAX)),
    heroSubtitle: preventAwkwardBreaks(truncateJa(contents.heroSubtitle, HERO_SUBTITLE_MAX)),
    concept: truncateJa(contents.concept, BODY_MAX),
    sections: contents.sections.map(clampSection),
    access: { ...contents.access, addressHint: truncateJa(contents.access.addressHint, BODY_MAX) },
    cta: { ...contents.cta, body: truncateJa(contents.cta.body, BODY_MAX) },
    faq: contents.faq.map((item) => ({ ...item, answer: truncateJa(item.answer, BODY_MAX) })),
  };
}
