import { describe, expect, it } from "vitest";
import { hasValidCoordinatePair, isEventCurrent, matchesDirectoryLocation, selectRelatedProperties } from "@/features/directories/rules";

describe("nearby directories and events", () => {
  it("accepts valid Nigerian map coordinate pairs and rejects incomplete or out-of-range pins", () => {
    expect(hasValidCoordinatePair(6.5244, 3.3792)).toBe(true);
    expect(hasValidCoordinatePair(-90, 180)).toBe(true);
    expect(hasValidCoordinatePair(91, 3)).toBe(false);
    expect(hasValidCoordinatePair(6, -181)).toBe(false);
    expect(hasValidCoordinatePair(6, null)).toBe(false);
  });
  it("includes upcoming and ongoing events but excludes events that have ended", () => {
    const now = new Date("2026-11-25T12:00:00.000Z");
    expect(isEventCurrent("2026-11-26T12:00:00.000Z", null, now)).toBe(true);
    expect(isEventCurrent("2026-11-24T12:00:00.000Z", "2026-11-25T13:00:00.000Z", now)).toBe(true);
    expect(isEventCurrent("2026-11-24T12:00:00.000Z", "2026-11-25T11:59:00.000Z", now)).toBe(false);
    expect(isEventCurrent("not-a-date", null, now)).toBe(false);
  });
  it("prefers editor-curated property links and otherwise discovers approved same-city stays", () => {
    expect(selectRelatedProperties(["curated"], ["nearby-1", "nearby-2"])).toEqual(["curated"]);
    expect(selectRelatedProperties([], ["nearby-1", "nearby-2"], 1)).toEqual(["nearby-1"]);
    expect(selectRelatedProperties([], ["nearby-1"], 0)).toEqual([]);
  });
  it("filters listings by the selected city without changing unfiltered discovery", () => {
    expect(matchesDirectoryLocation("lagos-city")).toBe(true);
    expect(matchesDirectoryLocation("lagos-city", "lagos-city")).toBe(true);
    expect(matchesDirectoryLocation("ilorin-city", "lagos-city")).toBe(false);
  });
});
