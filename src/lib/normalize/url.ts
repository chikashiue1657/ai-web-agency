/**
 * URL抽出・分類の純関数群。
 * - 欠損/表記揺れ(http無し, 末尾スラッシュ, トラッキングパラメータ)に強く。
 * - SNS(Instagram/Facebook)と公式サイトを区別する。
 * - 入力は string | string[] | null/undefined を許容。
 */

/** 文字列を緩く正規化したURLに整える。失敗時 null。 */
export function normalizeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;

  // 全角・余分な空白の除去
  s = s.replace(/\s+/g, "");

  // スキーム補完
  if (!/^https?:\/\//i.test(s)) {
    // www. や ドメインらしき形のみ補完（メール等は除外）
    if (/^[\w-]+(\.[\w-]+)+/.test(s)) {
      s = "https://" + s;
    } else {
      return null;
    }
  }

  try {
    const u = new URL(s);
    // トラッキングパラメータ除去
    const params = u.searchParams;
    for (const key of [...params.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|igshid)/i.test(key)) params.delete(key);
    }
    u.search = params.toString();
    // 末尾スラッシュ正規化（パスが "/" のみなら削除）
    let out = u.toString();
    if (u.pathname === "/" && !u.search && !u.hash) {
      out = out.replace(/\/$/, "");
    }
    return out;
  } catch {
    return null;
  }
}

/** ホスト名を取り出す（小文字, www除去）。失敗時 null。 */
export function getHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const INSTAGRAM_HOSTS = ["instagram.com", "instagr.am"];
const FACEBOOK_HOSTS = ["facebook.com", "fb.com", "fb.me", "m.facebook.com"];

export function isInstagramUrl(url: string | null): boolean {
  const host = getHost(url);
  return !!host && INSTAGRAM_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

export function isFacebookUrl(url: string | null): boolean {
  const host = getHost(url);
  return !!host && FACEBOOK_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

/**
 * 「公式サイトとみなさない」ドメイン。
 * Googleマップ/食べログ/ホットペッパー等のポータルやSNSはHP扱いにしない。
 */
const NON_WEBSITE_HOSTS = [
  ...INSTAGRAM_HOSTS,
  ...FACEBOOK_HOSTS,
  "tabelog.com",
  "hotpepper.jp",
  "beauty.hotpepper.jp",
  "goo.gl",
  "g.page",
  "maps.google.com",
  "google.com",
  "gnavi.co.jp",
  "retty.me",
  "ekiten.jp",
  "line.me",
  "lin.ee",
  "x.com",
  "twitter.com",
  "linktr.ee",
];

/** 公式サイトとみなせるURLか（ポータル/SNSを除外）。 */
export function looksLikeOfficialWebsite(url: string | null): boolean {
  const host = getHost(url);
  if (!host) return false;
  return !NON_WEBSITE_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

/**
 * 候補URL群(文字列/配列/混在)からSNS・公式サイトを抽出する。
 * raw_payload中に複数URLが散在するケースを吸収する。
 */
export interface ExtractedUrls {
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
}

export function extractUrls(...candidates: unknown[]): ExtractedUrls {
  const urls: string[] = [];
  const visit = (v: unknown) => {
    if (v == null) return;
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v === "string") {
      // 文中の複数URLも拾う（マッチ結果は再visitせず直接正規化して再帰を止める）
      const matches = v.match(/https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/gi);
      if (matches) {
        for (const m of matches) {
          const n = normalizeUrl(m);
          if (n) urls.push(n);
        }
      } else {
        const n = normalizeUrl(v);
        if (n) urls.push(n);
      }
      return;
    }
  };
  candidates.forEach(visit);

  let website: string | null = null;
  let instagram: string | null = null;
  let facebook: string | null = null;

  for (const raw of urls) {
    const u = normalizeUrl(raw);
    if (!u) continue;
    if (isInstagramUrl(u)) {
      instagram ??= u;
    } else if (isFacebookUrl(u)) {
      facebook ??= u;
    } else if (looksLikeOfficialWebsite(u)) {
      website ??= u;
    }
  }

  return { website_url: website, instagram_url: instagram, facebook_url: facebook };
}
