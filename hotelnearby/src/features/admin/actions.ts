"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRoles } from "@/features/auth/authorization";

async function adminContext() {
  return requirePlatformRoles(["administrator"]);
}

export async function setUserStatusAction(formData: FormData) {
  const { supabase } = await adminContext();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["active", "suspended"].includes(status)) throw new Error("Invalid account status request.");
  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: userId, p_status: status, p_reason: reason || null });
  if (error) throw new Error(error.message || "Account status could not be changed.");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function setOrganisationStatusAction(formData: FormData) {
  const { supabase } = await adminContext();
  const organisationId = String(formData.get("organisationId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(organisationId) || !["active", "suspended"].includes(status)) throw new Error("Invalid organisation status request.");
  const { error } = await supabase.rpc("admin_set_organisation_status", { p_organisation_id: organisationId, p_status: status, p_reason: reason || null });
  if (error) throw new Error(error.message || "Organisation status could not be changed.");
  revalidatePath("/admin/organisations");
  revalidatePath("/admin");
}

export async function moderatePropertyAction(formData: FormData) {
  const { supabase } = await adminContext();
  const propertyId = String(formData.get("propertyId") ?? "");
  const action = String(formData.get("action") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !["approve", "reject", "request_corrections", "suspend", "reinstate"].includes(action)) throw new Error("Invalid property moderation request.");
  const { error } = await supabase.rpc("admin_moderate_property", { p_property_id: propertyId, p_action: action, p_note: note || null });
  if (error) throw new Error(error.message || "Property moderation could not be saved.");
  revalidatePath("/admin/properties");
  revalidatePath("/admin");
}

export async function setVerificationAction(formData: FormData) {
  const { supabase } = await adminContext();
  const propertyId = String(formData.get("propertyId") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !["unverified", "pending", "verified", "rejected"].includes(status)) throw new Error("Invalid verification request.");
  const { error } = await supabase.rpc("admin_set_verification", { p_property_id: propertyId, p_status: status, p_note: note || null });
  if (error) throw new Error(error.message || "Verification record could not be updated.");
  revalidatePath("/admin/properties");
}

export async function setPlatformRoleAction(formData: FormData) {
  const { supabase } = await adminContext();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["visitor", "administrator", "editor_moderator"].includes(role)) throw new Error("Invalid role assignment.");
  const { error } = await supabase.rpc("set_platform_role", { p_user_id: userId, p_role: role });
  if (error) throw new Error(error.message || "Role could not be changed.");
  revalidatePath("/admin/users");
  revalidatePath("/admin/permissions");
}

export async function setPermissionGrantAction(formData: FormData) {
  const { supabase } = await adminContext();
  const userId = String(formData.get("userId") ?? "");
  const permissionKey = String(formData.get("permissionKey") ?? "");
  const granted = String(formData.get("granted") ?? "") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid staff account.");
  const { error } = await supabase.rpc("admin_set_permission_grant", { p_user_id: userId, p_permission_key: permissionKey, p_granted: granted });
  if (error) throw new Error(error.message || "Permission could not be updated.");
  revalidatePath("/admin/permissions");
}
