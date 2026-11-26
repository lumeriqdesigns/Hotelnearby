"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformRoles } from "@/features/auth/authorization";

async function requireAdmin() {
  const context = await requirePlatformRoles(["administrator"]);
  return { supabase: context.supabase, user: context.user };
}

async function auditDestinationAction(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>, actorId: string, action: string, targetType: string, targetId: string, afterState: Record<string, unknown>) {
  const { error } = await supabase.from("admin_audit_logs").insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, after_state: afterState });
  if (error) throw new Error("The destination was saved, but its audit record could not be written. Contact the platform administrator.");
}

export async function saveDestinationControls(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const locationId = String(formData.get("locationId") ?? "");
  const displayOrder = Number(formData.get("displayOrder") ?? 0);
  const manuallySelected = formData.get("manuallySelected") === "on";
  if (!/^[0-9a-f-]{36}$/i.test(locationId) || !Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 100000) {
    throw new Error("Invalid destination control values.");
  }
  const { error } = await supabase.from("destination_profiles").update({ manually_selected: manuallySelected, display_order: displayOrder, updated_at: new Date().toISOString() }).eq("location_id", locationId);
  if (error) throw new Error("Could not save destination controls. Confirm the Prompt 6 migration has been applied.");
  await auditDestinationAction(supabase, user.id, "destination.homepage_selection_updated", "location", locationId, { manually_selected: manuallySelected, display_order: displayOrder });
  revalidatePath("/admin/destinations");
  revalidatePath("/destinations");
  redirect("/admin/destinations?saved=1");
}

export async function saveDestinationEditorial(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const locationId = String(formData.get("locationId") ?? "");
  const editorialSummary = String(formData.get("editorialSummary") ?? "").trim();
  const status = String(formData.get("status") ?? "upcoming");
  if (!/^[0-9a-f-]{36}$/i.test(locationId) || !["upcoming", "in_review", "published", "unpublished"].includes(status)) throw new Error("Invalid destination editorial values.");
  const update = {
    editorial_summary: editorialSummary,
    publication_status: status,
    reviewed_by: status === "published" ? user.id : null,
    reviewed_at: status === "published" ? new Date().toISOString() : null,
    published_at: status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("destination_profiles").update(update).eq("location_id", locationId);
  if (error) throw new Error("Destination could not be updated. Publication is blocked until its quality threshold is met.");
  await auditDestinationAction(supabase, user.id, "destination.editorial_status_updated", "location", locationId, { publication_status: status });
  revalidatePath("/admin/destinations");
  revalidatePath("/destinations");
  redirect("/admin/destinations?saved=1");
}

export async function addDestinationPlace(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const parentId = String(formData.get("parentId") ?? "");
  const level = String(formData.get("level") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!/^[0-9a-f-]{36}$/i.test(parentId) || !["neighbourhood", "landmark"].includes(level) || name.length < 2 || name.length > 120 || !slug) {
    throw new Error("Invalid neighbourhood or landmark details.");
  }
  const { error } = await supabase.from("location_nodes").insert({ parent_id: parentId, level, name, slug, country_code: "NG" });
  if (error) throw new Error("Could not add this place. Check its parent level and ensure the name is unique within that parent.");
  await auditDestinationAction(supabase, user.id, "destination.place_added", "location", parentId, { name, level, slug });
  revalidatePath("/admin/destinations");
  revalidatePath("/destinations");
  redirect("/admin/destinations?saved=1");
}

export async function addDestinationContentItem(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const locationId = String(formData.get("locationId") ?? "");
  const contentType = String(formData.get("contentType") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const sourceReference = String(formData.get("sourceReference") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  const verified = formData.get("verified") === "on";
  const allowedTypes = ["attraction", "local_business", "event", "transport", "guide", "visitor_information"];
  if (!/^[0-9a-f-]{36}$/i.test(locationId) || !allowedTypes.includes(contentType) || title.length < 3 || title.length > 160 || summary.length < 40 || summary.length > 1200 || !["draft", "in_review", "published", "unpublished"].includes(status)) {
    throw new Error("Invalid destination content. The summary must be between 40 and 1,200 characters.");
  }
  if (status === "published" && (!verified || !sourceReference)) throw new Error("To publish, confirm verification and provide a source reference.");
  const { error } = await supabase.from("destination_content_items").insert({
    location_id: locationId,
    content_type: contentType,
    title,
    summary,
    source_reference: sourceReference || null,
    verification_status: status === "published" && verified ? "verified" : "unverified",
    publication_status: status,
    reviewed_by: status === "published" ? user.id : null,
    reviewed_at: status === "published" ? new Date().toISOString() : null,
    published_at: status === "published" ? new Date().toISOString() : null,
  });
  if (error) throw new Error("Content could not be saved. Confirm the source, field limits and destination status.");
  await auditDestinationAction(supabase, user.id, "destination.content_item_added", "destination_content_item", locationId, { content_type: contentType, title, publication_status: status });
  revalidatePath("/admin/destinations");
  revalidatePath("/destinations");
  redirect("/admin/destinations?saved=1");
}
