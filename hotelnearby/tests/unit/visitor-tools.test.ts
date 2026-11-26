import { describe, expect, it } from "vitest";
import { calculateAccommodationTotal, compareLimitReached, haversineDistanceKm, matchSuitability, splitGroupCost } from "@/features/visitor/rules";

describe("visitor planning tools", () => {
  it("calculates accommodation only for supported daily price bases", () => {
    expect(calculateAccommodationTotal(25000, "night", 3)).toBe(75000);
    expect(calculateAccommodationTotal(25000, "stay", 3)).toBeNull();
    expect(calculateAccommodationTotal(null, "night", 3)).toBeNull();
  });
  it("splits group costs and rejects invalid group sizes", () => {
    expect(splitGroupCost(120000, 6)).toBe(20000);
    expect(splitGroupCost(120000, 0)).toBeNull();
  });
  it("calculates straight-line distance and rejects invalid coordinates", () => {
    expect(haversineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.19, 1);
    expect(haversineDistanceKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeNull();
  });
  it("reports only property-listed suitability features", () => {
    expect(matchSuitability(["wifi", "accessible"], ["wifi"], ["accessible"]).matched).toEqual(["wifi", "accessible"]);
    expect(matchSuitability(["wifi", "pool"], ["wifi"], []).notListed).toEqual(["pool"]);
  });
  it("limits comparisons to three", () => {
    expect(compareLimitReached(2)).toBe(false);
    expect(compareLimitReached(3)).toBe(true);
  });
});
