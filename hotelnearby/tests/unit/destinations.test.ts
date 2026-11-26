import { describe, expect, it } from "vitest";

import { LAUNCH_TOWNS, LOCATION_LEVELS, NIGERIAN_STATES, getTownsForState } from "@/features/destinations/data";

describe("Nigeria destination reference data", () => {
  it("contains all 36 states and the Federal Capital Territory", () => {
    expect(NIGERIAN_STATES).toHaveLength(37);
    expect(NIGERIAN_STATES.filter((state) => state.name !== "Federal Capital Territory")).toHaveLength(36);
    expect(new Set(NIGERIAN_STATES.map((state) => state.slug)).size).toBe(37);
  });

  it("contains every requested Kwara launch town", () => {
    expect(getTownsForState("Kwara").map((town) => town.name)).toEqual([
      "Ilorin", "Offa", "Omu-Aran", "Jebba", "Lafiagi", "Patigi", "Kaiama", "Osi", "Igbaja", "Share",
    ]);
    expect(LAUNCH_TOWNS.every((town) => town.status === "upcoming")).toBe(true);
  });

  it("models the required geographic levels in parent-to-child order", () => {
    expect(LOCATION_LEVELS).toEqual(["country", "state", "city_town", "neighbourhood", "landmark"]);
  });

  it("does not invent property counts or neighbourhood/landmark records", () => {
    expect(LAUNCH_TOWNS.every((town) => !("approvedPropertyCount" in town))).toBe(true);
    expect(LOCATION_LEVELS).toContain("neighbourhood");
    expect(LOCATION_LEVELS).toContain("landmark");
  });
});
