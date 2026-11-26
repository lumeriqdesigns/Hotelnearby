import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/202611240003_property_detail_pages.sql"), "utf8");
const page = readFileSync(join(process.cwd(), "src/app/(public)/properties/[slug]/page.tsx"), "utf8");
const forms = readFileSync(join(process.cwd(), "src/components/properties/property-contact-forms.tsx"), "utf8");
const site = readFileSync(join(process.cwd(), "src/lib/site.ts"), "utf8");
const share = readFileSync(join(process.cwd(), "src/components/properties/share-property-button.tsx"), "utf8");
const gallery = readFileSync(join(process.cwd(), "src/components/properties/property-gallery.tsx"), "utf8");

describe("public property details", () => {
  it("keeps hotel room categories distinct from managed apartment units", () => {
    expect(migration).toContain("create table public.property_room_categories");
    expect(migration).toContain("create table public.property_apartment_units");
    expect(migration).toContain("room_categories");
    expect(migration).toContain("apartment_units");
  });

  it("supports requested pricing bases and the public price-update date", () => {
    for (const basis of ["night", "day", "week", "month", "stay", "other"]) expect(migration).toContain(`'${basis}'`);
    expect(migration).toContain("price_updated_at");
    expect(page).toContain("Last price updated");
    expect(site).toContain("Prices may change. Contact the property to confirm the current price and availability.");
  });

  it("restricts public details and submissions to approved active listings", () => {
    expect(migration.match(/approval_status='approved' and is_active/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("alter table public.property_enquiries enable row level security");
    expect(migration).toContain("alter table public.property_listing_reports enable row level security");
  });

  it("does not add booking or availability controls", () => {
    expect(page).not.toMatch(/availability calendar|book now|reserve now/i);
    expect(page).not.toContain("booking-button");
  });

  it("provides a native share action with a copy-link fallback", () => {
    expect(share).toContain("navigator.share");
    expect(share).toContain("navigator.clipboard.writeText");
  });

  it("provides enquiry and listing-report form modes", () => {
    expect(forms).toContain("Send an enquiry");
    expect(forms).toContain("Report this listing");
    expect(forms).toContain("/api/property-contact");
  });
});
