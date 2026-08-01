import { describe, expect, it } from "vitest";
import { StoreRealDataSchema } from "@/lib/validation";

describe("menu photo URL validation", () => {
  it("accepts HTTPS item photos", () => {
    expect(StoreRealDataSchema.safeParse({
      menuItems: [{ name: "Latte", imageUrl: "https://project.supabase.co/menu/latte.jpg" }],
    }).success).toBe(true);
  });

  it("rejects non-HTTPS and executable item URLs", () => {
    for (const imageUrl of ["http://example.com/a.jpg", "javascript:alert(1)", "data:image/png;base64,AA"] ) {
      expect(StoreRealDataSchema.safeParse({ menuItems: [{ name: "Latte", imageUrl }] }).success).toBe(false);
    }
  });
});
