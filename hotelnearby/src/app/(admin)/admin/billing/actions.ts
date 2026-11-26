"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformRoles } from "@/features/auth/authorization";
export async function updateBillingSettingsAction(formData: FormData) {
  const { supabase, user } = await requirePlatformRoles(["administrator"]);
  const grace = Number(formData.get("graceDays")); const taxRaw = String(formData.get("taxRate") ?? "").trim();
  const feeBps = Number(formData.get("processingFeeBps")); const feeFixed = Math.round(Number(formData.get("processingFeeFixed") ?? 0) * 100);
  const retries = [Number(formData.get("retryDay1")), Number(formData.get("retryDay2"))];
  if (!Number.isInteger(grace) || grace < 0 || grace > 60 || !Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000 || !Number.isFinite(feeFixed) || feeFixed < 0 || retries.some((v) => !Number.isInteger(v) || v < 1 || v > 30)) throw new Error("Check the billing configuration values.");
  const tax = taxRaw === "" ? null : Number(taxRaw);
  if (tax !== null && (!Number.isInteger(tax) || tax < 0 || tax > 10000)) throw new Error("Tax rate must be basis points between 0 and 10,000, or left blank.");
  const { error } = await supabase.from("platform_billing_settings").update({ grace_period_days: grace, payment_retry_days: retries, tax_rate_basis_points: tax, processing_fee_basis_points: feeBps, processing_fee_fixed_kobo: feeFixed, updated_by: user.id }).eq("id", true);
  if (error) throw new Error("Billing settings could not be saved. Apply the approved Prompt 14 migration first.");
  revalidatePath("/admin/billing");
}

export async function createPromotionPriceAction(formData: FormData) {
  const { supabase } = await requirePlatformRoles(["administrator"]);
  const type = String(formData.get("type") ?? ""); const duration = Number(formData.get("durationDays")); const naira = Number(formData.get("amountNaira"));
  const minimum = type === "featured" ? 3000 : type === "homepage" ? 7500 : 5000;
  if (!["featured", "homepage", "city", "category"].includes(type) || !Number.isInteger(duration) || duration < 1 || duration > 90 || !Number.isFinite(naira) || naira < minimum) throw new Error(`Enter a valid promotion type, duration and amount of at least ₦${minimum.toLocaleString("en-NG")}.`);
  const { error } = await supabase.from("promotion_prices").insert({ promotion_type: type, duration_days: duration, currency: "NGN", amount_kobo: Math.round(naira * 100), is_active: true });
  if (error) throw new Error("Could not add price. Retire an existing active price for the same placement and duration first.");
  revalidatePath("/admin/billing");
}
export async function retirePromotionPriceAction(formData: FormData) {
  const { supabase } = await requirePlatformRoles(["administrator"]);
  const id = String(formData.get("priceId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid promotion price.");
  const { error } = await supabase.from("promotion_prices").update({ is_active: false }).eq("id", id);
  if (error) throw new Error("Could not retire promotion price.");
  revalidatePath("/admin/billing");
}
