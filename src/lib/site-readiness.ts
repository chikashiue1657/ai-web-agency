import type { RealMenuItem, Store } from "@/lib/types";

export type ReadinessItem = {
  id: string;
  label: string;
  detail: string;
  points: number;
  complete: boolean;
  actionHref?: string;
};

export type SiteReadiness = {
  score: number;
  level: "ready" | "nearly-ready" | "needs-content";
  label: string;
  items: ReadinessItem[];
  nextActions: ReadinessItem[];
};

function hasOpeningHours(store: Store): boolean {
  return Boolean(store.opening_hours?.weekday_text?.length || store.opening_hours?.raw?.length);
}

/** Score only verified business material; generated copy cannot hide missing facts. */
export function assessSiteReadiness(store: Store, menuItems: RealMenuItem[], hasPreview: boolean): SiteReadiness {
  const namedMenu = menuItems.filter((item) => item.name.trim());
  const items: ReadinessItem[] = [
    { id: "contact", label: "連絡先", detail: "電話番号があり、予約・問い合わせボタンが実際に機能する", points: 15, complete: Boolean(store.phone) },
    { id: "location", label: "住所・アクセス", detail: "正確な住所を掲載し、Googleマップへ迷わず移動できる", points: 10, complete: Boolean(store.address) },
    { id: "hours", label: "営業時間", detail: "営業日と営業時間が確認でき、来店前の不安を減らす", points: 10, complete: hasOpeningHours(store) },
    { id: "menu", label: "主力メニュー3品", detail: "少なくとも3品の実在する商品名を登録する", points: 15, complete: namedMenu.length >= 3, actionHref: "#menu-editor" },
    { id: "prices", label: "メニュー価格", detail: "主力メニューに価格を入れ、来店判断を助ける", points: 10, complete: namedMenu.length >= 3 && namedMenu.every((item) => Boolean(item.price?.trim())), actionHref: "#menu-editor" },
    { id: "menu-photos", label: "メニュー写真3枚", detail: "売りたい商品を実写真で見せ、テンプレート感をなくす", points: 15, complete: namedMenu.filter((item) => Boolean(item.imageUrl)).length >= 3, actionHref: "#menu-editor" },
    { id: "store-photos", label: "店舗写真", detail: "外観・内観・商品など3枚以上の実写真がある", points: 10, complete: store.photo_count >= 3 },
    { id: "trust", label: "信頼情報", detail: "Google評価と口コミ件数を実データとして掲載できる", points: 5, complete: store.rating != null && store.review_count > 0 },
    { id: "social", label: "公式SNS", detail: "日々の営業状況が分かる公式SNSへの導線がある", points: 5, complete: Boolean(store.instagram_url || store.facebook_url) },
    { id: "preview", label: "最新プレビュー", detail: "最新の実データを反映した販売確認用サイトを生成する", points: 5, complete: hasPreview },
  ];
  const score = items.reduce((sum, item) => sum + (item.complete ? item.points : 0), 0);
  const level = score >= 85 ? "ready" : score >= 65 ? "nearly-ready" : "needs-content";
  const label = level === "ready" ? "提案・納品できる状態" : level === "nearly-ready" ? "あと少しで提案可能" : "実データの追加が必要";
  return { score, level, label, items, nextActions: items.filter((item) => !item.complete).slice(0, 3) };
}
