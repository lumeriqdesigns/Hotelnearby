import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/202611240004_authentication_and_authorisation.sql"), "utf8");
const actions = readFileSync(join(process.cwd(), "src/features/auth/actions.ts"), "utf8");
const authorization = readFileSync(join(process.cwd(), "src/features/auth/authorization.ts"), "utf8");
const proxy = readFileSync(join(process.cwd(), "src/lib/supabase/proxy.ts"), "utf8");
const confirm = readFileSync(join(process.cwd(), "src/app/auth/confirm/route.ts"), "utf8");
const adminActions = readFileSync(join(process.cwd(), "src/app/(admin)/admin/destinations/actions.ts"), "utf8");

 describe("Supabase authentication and authorisation", () => {
  it("defines the five requested roles and prevents public self-assignment of privileged roles", () => {
    for (const role of ["visitor", "provider_owner", "provider_staff", "administrator", "editor_moderator"]) {
      expect(migration).toContain(`'${role}'`);
    }
    expect(migration).toContain("when new.raw_user_meta_data ->> 'account_type' = 'provider_owner' then 'provider_owner'");
    expect(migration).toContain("else 'visitor'");
    expect(migration).toContain("Only an existing administrator can grant/revoke platform staff roles");
  });

  it("protects profile roles with column-level grants and row-level security", () => {
    expect(migration).toContain("grant update (full_name, phone, avatar_url) on public.profiles to authenticated");
    expect(migration).toContain("Users update own non-role profile fields");
    expect(migration).toContain("Users read own profile or platform staff read all");
  });

  it("scopes provider data to organisation membership and blocks self-approval", () => {
    expect(migration).toContain("public.is_provider_member(organisation_id)");
    expect(migration).toContain("Only platform moderators can approve, reject or suspend listings");
    expect(migration).toContain("Only platform moderators can change verification status");
  });

  it("uses verified server identity and refreshes sessions in the Next.js 16 proxy", () => {
    expect(authorization).toContain("supabase.auth.getUser()");
    expect(authorization).toContain("requirePlatformRoles");
    expect(proxy).toContain("supabase.auth.getClaims()");
    expect(proxy).not.toContain("getSession()");
  });

  it("implements registration, password recovery and verification without hardcoded accounts", () => {
    expect(actions).toContain("supabase.auth.signUp");
    expect(actions).toContain("supabase.auth.signInWithPassword");
    expect(actions).toContain("supabase.auth.resetPasswordForEmail");
    expect(actions).toContain("supabase.auth.updateUser({ password");
    expect(confirm).toContain("supabase.auth.verifyOtp");
    expect(migration).not.toMatch(/insert into auth\.users/i);
    expect(adminActions).toContain("requirePlatformRoles");
    expect(adminActions).not.toContain("app_metadata?.role");
  });
});
