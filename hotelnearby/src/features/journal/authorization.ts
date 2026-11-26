import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformRoles } from "@/features/auth/authorization";

export async function requireJournalEditor() {
  const context = await requirePlatformRoles(["administrator", "editor_moderator"]);
  if (context.profile.role === "editor_moderator") {
    const { data: allowed, error } = await context.supabase.rpc("has_staff_permission", { p_permission_key: "content.manage" });
    if (error || allowed !== true) redirect("/account/profile");
  }
  return context;
}
