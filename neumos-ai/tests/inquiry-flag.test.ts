import { afterEach, describe, expect, it } from "vitest";
import { isInquiryFeatureEnabled } from "@/lib/inquiry-flag";

describe("isInquiryFeatureEnabled", () => {
  afterEach(() => {
    delete process.env.INQUIRY_ENABLED;
  });

  it("is enabled only for the exact string 'true'", () => {
    process.env.INQUIRY_ENABLED = "true";
    expect(isInquiryFeatureEnabled()).toBe(true);
  });

  it("trims surrounding whitespace before comparing", () => {
    process.env.INQUIRY_ENABLED = "  true  ";
    expect(isInquiryFeatureEnabled()).toBe(true);
  });

  it("is disabled when unset", () => {
    delete process.env.INQUIRY_ENABLED;
    expect(isInquiryFeatureEnabled()).toBe(false);
  });

  it("is disabled when empty", () => {
    process.env.INQUIRY_ENABLED = "";
    expect(isInquiryFeatureEnabled()).toBe(false);
  });

  it.each(["TRUE", "True", "1", "yes", "false", "enabled"])("is disabled for %s", (value) => {
    process.env.INQUIRY_ENABLED = value;
    expect(isInquiryFeatureEnabled()).toBe(false);
  });
});
