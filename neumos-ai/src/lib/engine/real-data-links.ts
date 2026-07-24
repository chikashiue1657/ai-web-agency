/**
 * 「実際に機能するリンクだけを表示する」を保証する層。
 *
 * ルールベース・LLMどちらの生成方式でも、主CTAボタンや連絡手段の見出し文言だけは
 * 業種テンプレートで自由に作れても、リンク先（tel:/Instagram URL等）は
 * brief.realDataに実データが存在する場合のみ組み立てられる。実データが無いのに
 * 「電話で予約する」「LINEで予約する」のようなラベルだけを表示すると、
 * クリックしても何も起きない・存在しない連絡手段を約束するボタンになってしまう
 * （本番監査で実際に発見された不具合）。
 *
 * そのため、cta.buttonLabel/href と contactMethods は生成方式に依らず
 * 必ずこのモジュールが最終決定する（buildCta/buildContactMethodsやLLM出力の
 * 該当フィールドは使わない）。headline/bodyのような channel非依存のコピーは
 * 生成結果をそのまま活かす。
 */
import type { StoreBrief, ContactMethod, WebsiteCta } from "@/lib/types";
import { classifyIndustry } from "@/lib/engine/industry";

const FALLBACK_LABEL = "お問い合わせする";
const FALLBACK_HREF = "#contact";
/** 主要CTAは1つ、補助的な連絡手段は最大2つまでにする（画面が導線だらけにならないように）。 */
const MAX_SECONDARY_METHODS = 2;

function mapsSearchUrl(brief: StoreBrief): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${brief.storeName} ${brief.area}`)}`;
}

/** 業種別の「電話予約」ボタン文言。実際に電話番号がある場合のみ使う。 */
function phoneCtaLabel(category: ReturnType<typeof classifyIndustry>): string {
  switch (category) {
    case "cafe":
    case "izakaya":
      return "電話で予約する";
    case "spa":
    case "hotel":
      return "今すぐ電話で予約する";
    case "hair_salon":
      // LINE予約の実データは扱っていないため、電話が使える場合はそちらに寄せる。
      return "お電話で予約する";
    default:
      return "お電話でのお問い合わせ";
  }
}

export function buildCtaWithRealLinks(headline: string, body: string, brief: StoreBrief): WebsiteCta {
  const category = classifyIndustry(brief.industry);
  const phone = brief.realData?.phone;

  if (phone) {
    return { headline, body, buttonLabel: phoneCtaLabel(category), href: `tel:${phone}` };
  }
  return { headline, body, buttonLabel: FALLBACK_LABEL, href: FALLBACK_HREF };
}

/** GoogleマップのリンクはstoreName+areaの検索クエリで常に組み立てられる（実在の確認を主張しない案内リンク）ため、電話・Instagramが無い場合の補助として使える。 */
function mapShownFor(category: ReturnType<typeof classifyIndustry>): boolean {
  return category === "cafe" || category === "izakaya" || category === "hotel" || category === "general";
}

export function buildContactMethodsWithRealLinks(brief: StoreBrief): ContactMethod[] {
  const category = classifyIndustry(brief.industry);
  const phone = brief.realData?.phone;
  const instagramUrl = brief.realData?.instagramUrl;

  const methods: ContactMethod[] = [];
  if (phone) methods.push({ label: "お電話でのお問い合わせ", href: `tel:${phone}` });
  if (instagramUrl) methods.push({ label: "Instagramを見る", href: instagramUrl });
  if (methods.length < MAX_SECONDARY_METHODS && mapShownFor(category)) {
    methods.push({ label: "Google マップで見る", href: mapsSearchUrl(brief) });
  }

  if (methods.length === 0) {
    methods.push({ label: FALLBACK_LABEL, href: FALLBACK_HREF });
  }

  return methods.slice(0, MAX_SECONDARY_METHODS + 1);
}
