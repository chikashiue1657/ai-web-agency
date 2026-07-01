/**
 * 生成物から、公開可能な単体HTMLドキュメントを組み立てる。
 * 将来の「公開自動化」（静的ホスティング等）でそのまま配信できるよう、
 * 外部ビルドパイプライン非依存（インラインCSSのみ）で完結させる。
 * Next.js版（`src/components/website/WebsiteRenderer.tsx`）と同じセクション構成
 * （Hero/About/Service/Feature/Gallery/FAQ/Access/Contact/Footer）を持つ、
 * 静的エクスポート用の書き出し先。
 */
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(input: string): string {
  return escapeHtml(input).replace(/\n/g, "<br />");
}

export function renderWebsitePreviewHtml(brief: StoreBrief, contents: GeneratedWebsiteContents): string {
  const aboutHtml = contents.sections
    .filter((s) => s.kind === "about")
    .map((s) => `<p>${nl2br(s.body)}</p>`)
    .join("\n");

  const serviceHtml = contents.sections
    .filter((s) => s.kind === "service")
    .map((s) => `<div class="card"><h3>${escapeHtml(s.heading)}</h3><p>${nl2br(s.body)}</p></div>`)
    .join("\n");

  const featureHtml = contents.sections
    .filter((s) => s.kind === "feature")
    .map((s) => `<div class="card"><h3>${escapeHtml(s.heading)}</h3><p>${nl2br(s.body)}</p></div>`)
    .join("\n");

  const galleryHtml = contents.gallery
    .map((g) => `<figure class="tile"><figcaption>${escapeHtml(g.caption)}</figcaption></figure>`)
    .join("\n");

  const faqHtml = contents.faq
    .map(
      (f) => `
      <div class="faq-item">
        <p class="faq-q">Q. ${escapeHtml(f.question)}</p>
        <p class="faq-a">A. ${escapeHtml(f.answer)}</p>
      </div>`
    )
    .join("\n");

  const gbpHtml = contents.googleBusinessImprovement.map((g) => `<li>${escapeHtml(g)}</li>`).join("\n");

  const contactMethodsHtml = contents.contactMethods
    .map((m) => `<span class="pill">${escapeHtml(m)}</span>`)
    .join("\n");

  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(contents.access.mapQuery)}&output=embed`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(contents.seoTitle)}</title>
<meta name="description" content="${escapeHtml(contents.metaDescription)}" />
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif; color: #1f2330; background: #fafafa; line-height: 1.8; }
  .hero { padding: 72px 24px; text-align: center; background: linear-gradient(135deg, #4c1d95, #6d28d9); color: #fff; }
  .hero h1 { font-size: clamp(28px, 5vw, 44px); margin: 0 0 16px; }
  .hero p { font-size: 18px; opacity: 0.92; margin: 0; }
  .concept { max-width: 720px; margin: 32px auto; padding: 0 24px; text-align: center; color: #4b5563; }
  main { max-width: 960px; margin: 0 auto; padding: 0 24px 64px; }
  .section { margin: 40px 0; padding: 24px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .section h2 { margin-top: 0; color: #4c1d95; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 16px; }
  .card { padding: 16px; border-radius: 10px; background: #faf9ff; border: 1px solid #ede9fe; }
  .card h3 { margin: 0 0 8px; font-size: 16px; }
  .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-top: 16px; }
  .tile { margin: 0; aspect-ratio: 1 / 1; border-radius: 12px; background: linear-gradient(135deg, #6d28d9, #a855f7); display: flex; align-items: flex-end; justify-content: center; padding: 8px; }
  .tile figcaption { font-size: 12px; color: #fff; text-align: center; }
  .access-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
  .access-grid iframe { width: 100%; height: 100%; min-height: 240px; border: 0; border-radius: 10px; }
  .cta { max-width: 960px; margin: 0 auto 64px; padding: 40px 24px; text-align: center; background: #ede9fe; border-radius: 16px; }
  .cta h3 { margin: 0 0 8px; font-size: 24px; }
  .cta .btn { display: inline-block; margin-top: 16px; padding: 12px 32px; background: #5b21b6; color: #fff; border-radius: 999px; text-decoration: none; font-weight: 600; }
  .pill { display: inline-block; margin: 4px; padding: 6px 14px; border-radius: 999px; border: 1px solid #ddd6fe; font-size: 12px; color: #4c1d95; }
  .faq-item { margin-bottom: 16px; }
  .faq-q { font-weight: 700; margin: 0 0 4px; }
  .faq-a { margin: 0; color: #4b5563; }
  footer { text-align: center; padding: 24px; color: #9ca3af; font-size: 13px; }
  @media (max-width: 640px) { .access-grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <div class="hero">
    <h1>${escapeHtml(contents.heroTitle)}</h1>
    <p>${escapeHtml(contents.heroSubtitle)}</p>
  </div>
  <p class="concept">${escapeHtml(contents.concept)}</p>
  <main>
    <section class="section">
      <h2>About</h2>
      ${aboutHtml}
    </section>
    <section class="section">
      <h2>Service</h2>
      <div class="cards">${serviceHtml}</div>
    </section>
    <section class="section">
      <h2>Feature</h2>
      <div class="cards">${featureHtml}</div>
    </section>
    <section class="section">
      <h2>Gallery</h2>
      <div class="gallery-grid">${galleryHtml}</div>
    </section>
    <section class="section">
      <h2>よくある質問</h2>
      ${faqHtml}
    </section>
    <section class="section">
      <h2>Access</h2>
      <div class="access-grid">
        <div>
          <p><strong>${escapeHtml(contents.access.areaLabel)}</strong></p>
          <p>${escapeHtml(contents.access.addressHint)}</p>
        </div>
        <iframe title="map" src="${mapSrc}" loading="lazy"></iframe>
      </div>
    </section>
    <section class="section">
      <h2>Googleビジネスプロフィール改善案</h2>
      <ul>${gbpHtml}</ul>
    </section>
  </main>
  <div class="cta">
    <h3>${escapeHtml(contents.cta.headline)}</h3>
    <p>${escapeHtml(contents.cta.body)}</p>
    <a class="btn" href="#contact">${escapeHtml(contents.cta.buttonLabel)}</a>
    <div>${contactMethodsHtml}</div>
  </div>
  <footer>Generated by Neumos AI for ${escapeHtml(brief.storeName)}</footer>
</body>
</html>`;
}
