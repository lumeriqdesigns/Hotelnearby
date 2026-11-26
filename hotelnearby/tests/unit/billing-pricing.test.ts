import { describe, expect, it } from "vitest";
import { billingPeriodEnd, proratedPeriodValue, proratedUnusedCredit } from "@/features/billing/pricing";

describe("billing proration", () => {
  const start = new Date("2026-01-01T00:00:00.000Z");
  const middle = new Date("2026-01-16T00:00:00.000Z");
  const end = new Date("2026-01-31T00:00:00.000Z");
  it("credits the unused portion of the current plan", () => {
    expect(proratedUnusedCredit(600_000, start, end, middle)).toBe(300_000);
  });
  it("prices an immediate upgrade only for the remaining period", () => {
    expect(proratedPeriodValue(1_000_000, start, end, middle)).toBe(500_000);
  });
  it("returns no credit after the billing period", () => {
    expect(proratedUnusedCredit(600_000, start, end, new Date("2026-02-01T00:00:00Z"))).toBe(0);
  });
  it("calculates calendar month and year boundaries", () => {
    expect(billingPeriodEnd(new Date("2026-01-31T00:00:00Z"), "annual").getFullYear()).toBe(2027);
    expect(billingPeriodEnd(new Date("2026-05-15T00:00:00Z"), "monthly").getMonth()).toBe(5);
  });
});
