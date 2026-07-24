/**
 * ヒーローコピー生成（営業訴求力優先＝CV重視）。
 *
 * 旧ロジックは salesAngle（「HP新規制作による検索流入と予約導線の確立」のような
 * “施策の説明”）をほぼそのまま見出しにしていたため、営業コピーとして弱かった。
 * ここでは「店舗オーナーが伝えたい価値」を優先し、業種ごとに定石の強い言い回しへ
 * 寄せる。ブリーフに無い具体的な事実（症状名・価格・実績数値等）は捏造しないため、
 * 業種テンプレートは「アスピレーショナルだが事実性を伴わない」表現に留め、
 * 固有の値はbrief自身のフィールド（storeName/offer等）からのみ取る。
 */
import type { StoreBrief } from "@/lib/types";
import { classifyIndustry } from "@/lib/engine/industry";
import { truncateJa, HERO_TITLE_MAX, HERO_SUBTITLE_MAX } from "@/lib/engine/copy-limits";

function firstClause(text: string): string {
  return text.split(/[。／/]/)[0]?.trim() || text;
}

/** offerから短い名詞句を取り出す（「〜による」「〜の」等の説明的な接尾を削る）。 */
function offerHeadline(offer: string): string {
  return firstClause(offer).replace(/による.*$/, "").replace(/の(ご案内|ご提供)$/, "");
}

export function buildHeroTitle(brief: StoreBrief): string {
  const category = classifyIndustry(brief.industry);
  const offerHead = offerHeadline(brief.offer);

  const title = (() => {
    switch (category) {
      case "cafe":
        return `毎日通いたくなる${brief.storeName}`;
      case "hair_salon":
        return "あなた史上最高の髪へ";
      case "spa":
        return `${offerHead}で、根本から変わる`;
      case "izakaya":
        return `旨い一杯と、${brief.storeName}の時間を`;
      case "hotel":
        return `特別なひとときを、${brief.storeName}で`;
      default: {
        const angleHead = firstClause(brief.salesAngle);
        return `${brief.storeName} — ${angleHead}`;
      }
    }
  })();

  return truncateJa(title, HERO_TITLE_MAX);
}

export function buildHeroSubtitle(brief: StoreBrief, personaHeadline: string): string {
  const category = classifyIndustry(brief.industry);
  const offerHead = offerHeadline(brief.offer);

  const subtitle = (() => {
    switch (category) {
      case "cafe":
        return `${brief.area}で過ごす、ほっとひと息つける時間。${offerHead}をどうぞ。`;
      case "hair_salon":
        return `${offerHead}で、なりたい自分に出会える一軒。`;
      case "spa":
        return `${personaHeadline}へ。${offerHead}で、つらさを繰り返さない体づくりを。`;
      case "izakaya":
        return `${offerHead}を、気の置けない仲間と。${brief.area}の一軒。`;
      case "hotel":
        return `${personaHeadline}へ。${offerHead}で、忘れられない滞在を。`;
      default:
        return `${personaHeadline}へ。${brief.offer}`;
    }
  })();

  return truncateJa(subtitle, HERO_SUBTITLE_MAX);
}
