import { describe, expect, it } from "vitest";
import { calculatePromotionEndAt, getApprovedPromotionStatus, isValidPromotionTarget } from "@/features/promotions/rules";

describe("promotional placement rules", () => {
  it("calculates the end time from the approved start and purchased duration", () => {
    const start = new Date("2026-12-01T10:00:00.000Z");
    expect(calculatePromotionEndAt(start, 7).toISOString()).toBe("2026-12-08T10:00:00.000Z");
    expect(calculatePromotionEndAt(start, 30).toISOString()).toBe("2026-12-31T10:00:00.000Z");
  });
  it("rejects invalid durations and dates", () => {
    expect(() => calculatePromotionEndAt(new Date("invalid"), 7)).toThrow();
    expect(() => calculatePromotionEndAt(new Date(), 0)).toThrow();
    expect(() => calculatePromotionEndAt(new Date(), 91)).toThrow();
  });
  it("schedules future starts and activates current starts", () => {
    const now = new Date("2026-11-25T12:00:00.000Z");
    expect(getApprovedPromotionStatus(new Date("2026-11-26T12:00:00.000Z"), now)).toBe("scheduled");
    expect(getApprovedPromotionStatus(now, now)).toBe("active");
  });
  it("requires a matching target only for city and category promotions", () => {
    expect(isValidPromotionTarget("featured")).toBe(true);
    expect(isValidPromotionTarget("homepage", null, null)).toBe(true);
    expect(isValidPromotionTarget("city", "city-id", null)).toBe(true);
    expect(isValidPromotionTarget("city", null, "hotel")).toBe(false);
    expect(isValidPromotionTarget("category", null, "hotel")).toBe(true);
    expect(isValidPromotionTarget("category", "city-id", "hotel")).toBe(false);
  });
});
