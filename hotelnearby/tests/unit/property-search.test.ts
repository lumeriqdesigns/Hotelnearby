import { describe, expect, it } from "vitest";

import {
  accommodationCategories,
  amenityOptions,
  featureOptions,
} from "@/features/search/types";

import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("property search configuration", () => {
  it("has unique accommodation category slugs", () => {
    const slugs = accommodationCategories.map(({ value }) => value);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain("serviced-apartment");
    expect(slugs).toContain("shortlet");
  });

  it("has unique amenity and feature filter values", () => {
    const amenities = amenityOptions.map(([slug]) => slug);
    const features = featureOptions.map(([slug]) => slug);
    expect(new Set(amenities).size).toBe(amenities.length);
    expect(new Set(features).size).toBe(features.length);
  });

  it("does not seed fictional public property records", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/202611240002_property_search.sql"),
      "utf8",
    );
    expect(migration).toContain("approval_status = 'approved'");
    expect(migration).toContain("is_active = true");
    expect(migration).toContain("create or replace function public.search_public_properties");
    expect(migration).not.toMatch(/insert\s+into\s+public\.properties/i);
  });
});
