import type { StoredInquiry } from "@/lib/inquiries";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export type NotificationResult = "sent" | "skipped" | "failed";

export async function sendInquiryNotification(inquiry: StoredInquiry): Promise<NotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.INQUIRY_NOTIFICATION_TO?.trim();
  const from = process.env.INQUIRY_FROM_EMAIL?.trim();
  if (!apiKey || !to || !from) return "skipped";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": `site-inquiry-${inquiry.id}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `【${inquiry.storeName}】新しい${inquiry.inquiryType === "reservation" ? "予約相談" : "お問い合わせ"}`,
        html: `<h1>新しいお問い合わせ</h1>
          <p><strong>店舗:</strong> ${escapeHtml(inquiry.storeName)}</p>
          <p><strong>お名前:</strong> ${escapeHtml(inquiry.name)}</p>
          <p><strong>メール:</strong> ${escapeHtml(inquiry.email ?? "未入力")}</p>
          <p><strong>電話:</strong> ${escapeHtml(inquiry.phone ?? "未入力")}</p>
          <p><strong>希望日:</strong> ${escapeHtml(inquiry.preferredDate ?? "未入力")}</p>
          <p><strong>内容:</strong></p><p>${escapeHtml(inquiry.message).replaceAll("\n", "<br>")}</p>`,
      }),
      signal: controller.signal,
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}
