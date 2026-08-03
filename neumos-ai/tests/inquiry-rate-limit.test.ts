import { beforeEach, describe, expect, it } from "vitest";
import { isInquiryRateLimited, resetInquiryRateLimitForTests } from "@/lib/inquiry-rate-limit";

describe("inquiry rate limiting", () => {
  beforeEach(resetInquiryRateLimitForTests);

  it("allows five submissions and rejects the sixth in one window", () => {
    for (let index = 0; index < 5; index += 1) expect(isInquiryRateLimited("ip:request")).toBe(false);
    expect(isInquiryRateLimited("ip:request")).toBe(true);
    expect(isInquiryRateLimited("other-ip:request")).toBe(false);
  });
});
