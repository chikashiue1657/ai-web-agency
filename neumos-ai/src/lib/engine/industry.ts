/**
 * 業種分類（Hero/Feature/CTA/デザインテーマで共通利用）。
 * brief.industry は自由記述の日本語ラベルのため、正規表現で既知の業種カテゴリへ
 * 寄せる。どれにも一致しない場合は "general"（現行の汎用ロジック）にフォールバックする。
 */
export type IndustryCategory = "cafe" | "hair_salon" | "spa" | "izakaya" | "hotel" | "general";

const PATTERNS: [RegExp, IndustryCategory][] = [
  [/カフェ|喫茶|コーヒー|コーヒーショップ|cafe/i, "cafe"],
  [/美容室|ヘアサロン|美容院|理容|hair\s*salon|barber/i, "hair_salon"],
  [/整体|整骨|接骨|カイロ|マッサージ|エステ|リラクゼーション|もみほぐし/i, "spa"],
  [/居酒屋|バー|bar(?!ber)|立ち飲み|飲み屋|ダイニング/i, "izakaya"],
  [/ホテル|旅館|宿(?!題)|民宿|ゲストハウス|hotel/i, "hotel"],
];

export function classifyIndustry(industry: string): IndustryCategory {
  for (const [pattern, category] of PATTERNS) {
    if (pattern.test(industry)) return category;
  }
  return "general";
}
