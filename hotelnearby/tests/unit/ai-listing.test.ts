import { describe, expect, it } from "vitest";
import { emptyGuideSuggestions, listingCategories } from "@/features/ai-listing/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

describe("AI Listing Guide safeguards", () => {
  it("uses only supported accommodation categories", () => {
    expect(listingCategories).toContain("hotel");
    expect(listingCategories).toContain("serviced-apartment");
    expect(new Set(listingCategories).size).toBe(listingCategories.length);
  });

  it("starts with empty suggestions rather than fabricated property facts", () => {
    expect(emptyGuideSuggestions.suggestedCategory).toBeNull();
    expect(emptyGuideSuggestions.descriptionDraft).toBe("");
    expect(emptyGuideSuggestions.suggestedAmenities).toEqual([]);
  });

  it("keeps generation server-side and enforces bounded usage", () => {
    const route = readFileSync(resolve(root, "src/app/api/provider/ai-listing/route.ts"), "utf8");
    const migration = readFileSync(resolve(root, "supabase/migrations/202611240006_ai_listing_guide.sql"), "utf8");
    expect(route).toContain("requirePlatformRoles");
    expect(route).toContain("OPENAI_API_KEY");
    expect(route).toContain("https://api.openai.com/v1/responses");
    expect(route).toContain("authorization: `Bearer ${apiKey}`");
    expect(route).toContain('type: "json_schema"');
    expect(route).toContain("consume_ai_listing_quota");
    expect(route).toContain("max_output_tokens: 1100");
    expect(migration).toContain("request_count < 20");
    expect(migration).toContain("turn_count between 0 and 12");
    expect(migration).toContain("enable row level security");
  });

  it("does not let AI create approved or verified listings", () => {
    const actions = readFileSync(resolve(root, "src/features/organisations/actions.ts"), "utf8");
    expect(actions).toContain('approval_status: "draft", verification_status: "unverified"');
    expect(actions).toContain('status: "draft_created"');
    expect(actions).not.toContain('approval_status: "approved"');
  });

  it("requires provider confirmation for AI-suggested amenities", () => {
    const component = readFileSync(resolve(root, "src/features/ai-listing/ai-listing-guide.tsx"), "utf8");
    expect(component).toContain("Amenities to confirm");
    expect(component).toContain('name="confirmedAmenity"');
    expect(component).toContain("Save as an unpublished property draft");
  });
});
