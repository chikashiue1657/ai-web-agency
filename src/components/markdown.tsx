/**
 * 依存ゼロの極小Markdownレンダラ（提案書プレビュー用）。
 * - 見出し/箇条書き/引用/段落のみ対応。外部入力は提案書(自社生成)に限るためXSSリスクは低いが、
 *   念のためHTMLエスケープしてからタグ化する。
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  // **bold** のみ簡易対応
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const html: string[] = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      closeList();
      continue;
    }
    if (t.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inline(t.slice(4))}</h3>`);
    } else if (t.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inline(t.slice(3))}</h2>`);
    } else if (t.startsWith("# ")) {
      closeList();
      html.push(`<h1>${inline(t.slice(2))}</h1>`);
    } else if (t.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${inline(t.slice(2))}</blockquote>`);
    } else if (/^[-*] /.test(t)) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inline(t.slice(2))}</li>`);
    } else if (/^\d+\. /.test(t)) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inline(t.replace(/^\d+\.\s/, ""))}</li>`);
    } else if (t === "---") {
      closeList();
      html.push("<hr/>");
    } else {
      closeList();
      html.push(`<p>${inline(t)}</p>`);
    }
  }
  closeList();

  return <div className="prose-mini text-sm" dangerouslySetInnerHTML={{ __html: html.join("\n") }} />;
}
