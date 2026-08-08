import { describe, expect, it } from "vitest";
import { PublicInquirySchema } from "@/lib/inquiries";

const valid = {
  requestId: "97e73c6c-520e-48d9-8e04-c152c42baf9d",
  inquiryType: "reservation",
  name: "山田 太郎",
  email: "taro@example.com",
  phone: "",
  preferredDate: "2026-08-10",
  message: "2名で予約できますか",
  consent: true,
  website: "",
  startedAt: Date.now() - 3_000,
};

describe("PublicInquirySchema", () => {
  it("accepts a valid reservation and trims text", () => {
    const result = PublicInquirySchema.parse({ ...valid, name: "  山田 太郎  " });
    expect(result.name).toBe("山田 太郎");
    expect(result.phone).toBeUndefined();
  });

  it("requires either email or phone", () => {
    expect(PublicInquirySchema.safeParse({ ...valid, email: "", phone: "" }).success).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    expect(PublicInquirySchema.safeParse({ ...valid, preferredDate: "2026-02-31" }).success).toBe(false);
  });

  it("preserves honeypot content for the route to silently discard and rejects missing consent", () => {
    expect(PublicInquirySchema.parse({ ...valid, website: "https://spam.example" }).website).toBe("https://spam.example");
    expect(PublicInquirySchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });
});
