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
import type { StoreBrief, StoreRealData, ContactMethod, WebsiteCta } from "@/lib/types";
import { classifyIndustry } from "@/lib/engine/industry";

const FALLBACK_LABEL = "お問い合わせする";
const FALLBACK_HREF = "#contact";
/**
 * 主要CTAは1つ、補助的な連絡手段は最大 MAX_SECONDARY_METHODS 件までにする
 * （画面が導線だらけにならないように）。優先順位は電話→公式サイト→Instagram→
 * Google Mapsの順（`buildContactMethodsWithRealLinks`参照）。
 */
const MAX_SECONDARY_METHODS = 2;

/**
 * Google Mapsへの実リンクを次の優先順位で解決する（AccessHoursV2・
 * buildContactMethodsWithRealLinksの両方が使う唯一の決定箇所）。
 *  1. realData.googleMapsUrl — Google Places由来の検証済みURL。
 *     文字列検索URLへ作り直さず、そのまま使う。
 *  2. realData.addressを使った検索URL — 実住所ベースなので1より精度は
 *     落ちるが、テキスト検索よりは実データに基づく。
 *  3. fallbackQuery（storeName+area等）を使った検索URL — 実データが
 *     何も無い場合の従来どおりの案内リンク（架空のURLを作るわけではない）。
 */
export function resolveGoogleMapsUrl(realData: StoreRealData | undefined, fallbackQuery: string): string {
  if (realData?.googleMapsUrl) return realData.googleMapsUrl;
  const query = realData?.address || fallbackQuery;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
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

/** Googleマップのリンクは実データが無くても検索クエリで常に組み立てられる（実在の確認を主張しない案内リンク）ため、電話・公式サイト・Instagramが無い場合の補助として使える。 */
function mapShownFor(category: ReturnType<typeof classifyIndustry>): boolean {
  return category === "cafe" || category === "izakaya" || category === "hotel" || category === "general";
}

/**
 * 補助的な連絡手段の優先順位: 電話 → 公式サイト → Instagram → Google Maps。
 * 電話・公式サイト・Instagramは実データが無ければ候補にすら入れない（架空の
 * リンクを作らない）。Google Mapsだけは`mapShownFor(category)`が真の業種なら
 * 実データが無くても検索案内として候補に入る（実在の確認は主張しない）。
 * 優先順位どおりに並べた候補を組み立てたうえで、上位 MAX_SECONDARY_METHODS
 * （2）件だけを残す（画面が導線だらけにならないように。実データが多い店舗
 * でも常に上位2件のみを表示する）。
 */
export function buildContactMethodsWithRealLinks(brief: StoreBrief): ContactMethod[] {
  const category = classifyIndustry(brief.industry);
  const phone = brief.realData?.phone;
  const websiteUrl = brief.realData?.websiteUrl;
  const instagramUrl = brief.realData?.instagramUrl;

  const candidates: ContactMethod[] = [];
  if (phone) candidates.push({ label: "お電話でのお問い合わせ", href: `tel:${phone}` });
  if (websiteUrl) candidates.push({ label: "公式サイトを見る", href: websiteUrl });
  if (instagramUrl) candidates.push({ label: "Instagramを見る", href: instagramUrl });
  if (mapShownFor(category)) {
    const mapsUrl = resolveGoogleMapsUrl(brief.realData, `${brief.storeName} ${brief.area}`);
    candidates.push({ label: "Google マップで見る", href: mapsUrl });
  }

  if (candidates.length === 0) {
    return [{ label: FALLBACK_LABEL, href: FALLBACK_HREF }];
  }

  return candidates.slice(0, MAX_SECONDARY_METHODS);
}
