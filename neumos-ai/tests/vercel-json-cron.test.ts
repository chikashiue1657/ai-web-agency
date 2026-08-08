import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VERCEL_JSON_PATH = join(__dirname, "..", "vercel.json");
const CRON_PATTERN = /^([0-5]?\d|\*(\/[1-5]?\d)?)(,([0-5]?\d|\*(\/[1-5]?\d)?))*\s+([01]?\d|2[0-3]|\*(\/\d+)?)(,([01]?\d|2[0-3]|\*(\/\d+)?))*\s+([1-9]|[12]\d|3[01]|\*(\/\d+)?)(,([1-9]|[12]\d|3[01]|\*(\/\d+)?))*\s+([1-9]|1[0-2]|\*(\/\d+)?)(,([1-9]|1[0-2]|\*(\/\d+)?))*\s+([0-6]|\*(\/\d+)?)(,([0-6]|\*(\/\d+)?))*$/;

describe("vercel.json cron configuration", () => {
  const config = JSON.parse(readFileSync(VERCEL_JSON_PATH, "utf8")) as {
    crons?: { path: string; schedule: string }[];
  };

  it("defines exactly one cron entry for the inquiry cleanup route", () => {
    expect(config.crons).toHaveLength(1);
  });

  it("points the cron path at the actual inquiry cleanup API route", () => {
    expect(config.crons?.[0]?.path).toBe("/api/internal/inquiries/cleanup");
  });

  it("uses a valid 5-field cron schedule expression", () => {
    const schedule = config.crons?.[0]?.schedule ?? "";
    expect(schedule.split(/\s+/)).toHaveLength(5);
    expect(schedule).toMatch(CRON_PATTERN);
  });

  it("the referenced route file actually exists at the configured path", () => {
    const routePath = join(
      __dirname,
      "..",
      "src",
      "app",
      "api",
      "internal",
      "inquiries",
      "cleanup",
      "route.ts"
    );
    expect(() => readFileSync(routePath, "utf8")).not.toThrow();
  });
});
