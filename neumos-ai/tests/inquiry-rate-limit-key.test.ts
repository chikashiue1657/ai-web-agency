import { describe, expect, it } from "vitest";
import { computeRateLimitBucketKey } from "@/lib/inquiry-rate-limit-key";

const SALT = "a-sufficiently-random-salt-value";
const IP = "203.0.113.42";
const REQUEST_ID = "97e73c6c-520e-48d9-8e04-c152c42baf9d";

describe("computeRateLimitBucketKey", () => {
  it("returns a 64-character hex digest", () => {
    const key = computeRateLimitBucketKey(SALT, IP, REQUEST_ID);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never contains the raw IP as a substring", () => {
    const key = computeRateLimitBucketKey(SALT, IP, REQUEST_ID);
    expect(key).not.toContain(IP);
  });

  it("never contains the requestId in plaintext as a substring", () => {
    const key = computeRateLimitBucketKey(SALT, IP, REQUEST_ID);
    expect(key).not.toContain(REQUEST_ID);
  });

  it("produces the same bucket for the same (salt, ip, requestId)", () => {
    const a = computeRateLimitBucketKey(SALT, IP, REQUEST_ID);
    const b = computeRateLimitBucketKey(SALT, IP, REQUEST_ID);
    expect(a).toBe(b);
  });

  it("produces a different bucket for a different IP", () => {
    const a = computeRateLimitBucketKey(SALT, IP, REQUEST_ID);
    const b = computeRateLimitBucketKey(SALT, "198.51.100.7", REQUEST_ID);
    expect(a).not.toBe(b);
  });

  it("produces a different bucket for a different requestId", () => {
    const a = computeRateLimitBucketKey(SALT, IP, REQUEST_ID);
    const b = computeRateLimitBucketKey(SALT, IP, "11111111-1111-4111-8111-111111111111");
    expect(a).not.toBe(b);
  });

  it("produces a different bucket for a different salt", () => {
    const a = computeRateLimitBucketKey(SALT, IP, REQUEST_ID);
    const b = computeRateLimitBucketKey("a-different-salt-value", IP, REQUEST_ID);
    expect(a).not.toBe(b);
  });

  it("does not conflate (ip, requestId) pairs that would collide without a separator", () => {
    // ip="1" + requestId=":23" と ip="1:2" + requestId="3" は、区切り文字が
    // 無ければ同じ連結結果 "1:23" になりうる組み合わせ。
    const a = computeRateLimitBucketKey(SALT, "1", ":23");
    const b = computeRateLimitBucketKey(SALT, "1:2", "3");
    expect(a).not.toBe(b);
  });
});
