"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformRoles } from "@/features/auth/authorization";
export async function createInventorySlotAction(formData: FormData) {
  const { supabase } = await requirePlatformRoles(["administrator"]);
  const type = String(formData.get("type") ?? ""); const slotNumber = Number(formData.get("slotNumber")); const label = String(formData.get("label") ?? "").trim();
  const location = String(formData.get("locationId") ?? "") || null; const category = String(formData.get("categorySlug") ?? "") || null;
  if (!["featured", "homepage", "city", "category"].includes(type) || !Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 100 || label.length > 80 || (type === "city" && (!location || category)) || (type === "category" && (!category || location)) || (["featured", "homepage"].includes(type) && (location || category))) throw new Error("Check the inventory slot details and target.");
  const { error } = await supabase.from("promotional_inventory").insert({ slot_type: type, slot_number: slotNumber, label, target_location_id: location, target_category_slug: category, is_active: true });
  if (error) throw new Error("Could not create inventory slot. Check for a duplicate slot number or invalid target.");
  revalidatePath("/admin/promotions");
}
export async function toggleInventorySlotAction(formData: FormData) {
  const { supabase } = await requirePlatformRoles(["administrator"]); const id = String(formData.get("slotId") ?? ""); const active = String(formData.get("active") ?? "") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid inventory slot.");
  if (!active) {
    const { count, error: lookupError } = await supabase.from("promotions").select("id", { count: "exact", head: true }).eq("inventory_id", id).in("status", ["awaiting_payment", "paid", "pending_approval", "approved", "scheduled", "active"]);
    if (lookupError) throw new Error("Could not verify whether this slot is in use.");
    if ((count ?? 0) > 0) throw new Error("This slot has a pending, approved, scheduled or active placement. Wait until it is released before disabling the slot.");
  }
  const { error } = await supabase.from("promotional_inventory").update({ is_active: active }).eq("id", id);
  if (error) throw new Error("Could not update inventory slot."); revalidatePath("/admin/promotions");
}
