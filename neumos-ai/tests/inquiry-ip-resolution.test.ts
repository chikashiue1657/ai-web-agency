import { describe, expect, it } from "vitest";
import { resolveClientIp } from "@/lib/inquiry-ip";

function headers(values: Record<string, string>) {
  return { headers: { get: (name: string) => values[name.toLowerCase()] ?? null } };
}

describe("resolveClientIp", () => {
  it("prefers x-vercel-forwarded-for over x-forwarded-for", () => {
    const request = headers({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "198.51.100.1" });
    expect(resolveClientIp(request)).toBe("203.0.113.9");
  });

  it("falls back to x-forwarded-for when x-vercel-forwarded-for is absent", () => {
    const request = headers({ "x-forwarded-for": "198.51.100.1" });
    expect(resolveClientIp(request)).toBe("198.51.100.1");
  });

  it("takes the first entry of a comma-separated chain and trims whitespace", () => {
    const request = headers({ "x-vercel-forwarded-for": " 203.0.113.9 , 70.41.3.18, 150.172.238.178" });
    expect(resolveClientIp(request)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when neither forwarded header is present", () => {
    const request = headers({ "x-real-ip": "192.0.2.55" });
    expect(resolveClientIp(request)).toBe("192.0.2.55");
  });

  it("returns 'unknown' when no IP-bearing header is present", () => {
    expect(resolveClientIp(headers({}))).toBe("unknown");
  });

  it("ignores an empty x-vercel-forwarded-for value and falls back", () => {
    const request = headers({ "x-vercel-forwarded-for": "", "x-forwarded-for": "198.51.100.1" });
    expect(resolveClientIp(request)).toBe("198.51.100.1");
  });
});
