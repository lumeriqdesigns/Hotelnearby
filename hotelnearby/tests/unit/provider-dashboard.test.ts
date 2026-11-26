import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migration = readFileSync(resolve(root, "supabase/migrations/202611240005_provider_dashboard.sql"), "utf8");
const actions = readFileSync(resolve(root, "src/features/organisations/actions.ts"), "utf8");
const dashboard = readFileSync(resolve(root, "src/app/(provider)/dashboard/page.tsx"), "utf8");
const propertyPage = readFileSync(resolve(root, "src/app/(provider)/dashboard/properties/[id]/page.tsx"), "utf8");

describe("provider dashboard security and workflow", () => {
  it("links independently marketed properties to organisations", () => {
    expect(migration).toContain("foreign key (organisation_id) references public.provider_organisations(id)");
    expect(migration).toContain("properties_organisation_status_idx");
  });
  it("restricts organisation, team and invitation management to owners", () => {
    expect(migration).toContain("Owners update their organisation profile");
    expect(migration).toContain("Owners add members to their organisation");
    expect(migration).toContain("Owners create invitations for their organisation");
    expect(actions).toContain("providerContext(true)");
    expect(actions).toContain("createHash(\"sha256\")");
  });
  it("requires matching verified email and single-use invitation acceptance", () => {
    expect(migration).toContain("email_confirmed_at is not null");
    expect(migration).toContain("accepted_at is null and revoked_at is null");
    expect(migration).toContain("expires_at > now()");
  });
  it("keeps room categories and apartment units in distinct tables", () => {
    expect(propertyPage).toContain("property_room_categories");
    expect(propertyPage).toContain("property_apartment_units");
    expect(actions).toContain('kind === "room" ? "property_room_categories" : "property_apartment_units"');
  });
  it("submits listings for administrator review without provider auto-approval", () => {
    expect(actions).toContain('approval_status: "pending_review"');
    expect(propertyPage).toContain("Submit for administrator review");
    expect(migration).toContain("Only platform moderators can approve, reject or suspend listings");
  });
  it("shows live record counts and enquiry management without booking controls", () => {
    expect(dashboard).toContain("property_enquiries");
    expect(dashboard).toContain("New enquiries");
    expect(dashboard).toContain("Subscription overview");
    expect(dashboard.toLowerCase()).not.toContain("book a room");
  });
});
