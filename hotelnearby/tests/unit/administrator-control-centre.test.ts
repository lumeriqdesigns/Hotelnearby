import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/202611240007_administrator_control_centre.sql"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/app/(admin)/admin/layout.tsx"), "utf8");
const auth = readFileSync(join(process.cwd(), "src/features/auth/authorization.ts"), "utf8");
const actions = readFileSync(join(process.cwd(), "src/features/admin/actions.ts"), "utf8");
const providerActions = readFileSync(join(process.cwd(), "src/features/organisations/actions.ts"), "utf8");
const moderationActions = readFileSync(join(process.cwd(), "src/app/(admin)/admin/destinations/actions.ts"), "utf8");

describe("administrator control centre security", () => {
  it("restricts the admin layout and server actions to active administrators", () => {
    expect(layout).toContain('requirePlatformRoles(["administrator"])');
    expect(layout).not.toContain('"editor_moderator"');
    expect(actions).toContain('requirePlatformRoles(["administrator"])');
    expect(moderationActions).toContain('requirePlatformRoles(["administrator"])');
  });

  it("rejects suspended users during server-side authentication", () => {
    expect(auth).toContain('account_status === "suspended"');
    expect(migration).toContain("and account_status = 'active'");
    expect(migration).toContain("o.account_status = 'active' and p.account_status = 'active'");
  });

  it("audits account, organisation, role, property and permission changes", () => {
    for (const action of ["user.suspended", "user.reinstated", "organisation.suspended", "organisation.reinstated", "property.", "permission.granted", "permission.revoked", "user.role_changed"]) {
      expect(migration).toContain(action);
    }
    expect(migration).toContain("create table if not exists public.admin_audit_logs");
    expect(migration).not.toMatch(/create policy[^;]+admin_audit_logs[^;]+for update/i);
    expect(migration).not.toMatch(/create policy[^;]+admin_audit_logs[^;]+for delete/i);
  });

  it("keeps verification independent of property approval and account subscription", () => {
    expect(migration).toContain("admin_set_verification");
    expect(migration).toContain("verification_status=p_status");
    expect(migration).toContain("admin_moderate_property");
    expect(migration).toContain("verification_status',old_row.verification_status");
  });

  it("allows providers to correct and resubmit a correction-requested listing", () => {
    expect(migration).toContain("'correction_requested'");
    expect(providerActions).toContain('["draft","rejected","correction_requested"]');
    expect(providerActions).toContain('existing.approval_status === "suspended"');
  });

  it("prevents last-administrator lockout and prevents providers changing moderation fields", () => {
    expect(migration).toContain("The last active administrator cannot be suspended");
    expect(migration).toContain("The last active administrator cannot be demoted");
    expect(migration).toContain("new.verification_note is distinct from old.verification_note");
    expect(migration).toContain("new.moderation_note is distinct from old.moderation_note");
  });
});
