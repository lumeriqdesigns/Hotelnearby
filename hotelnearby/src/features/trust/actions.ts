"use server";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser, requirePlatformRoles } from "@/features/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const audit = async (supabase: any, actorId: string, entityType: string, entityId: string, action: string, reason?: string, metadata: Record<string, unknown> = {}) => {
  const { error } = await supabase.from("trust_audit_events").insert({ actor_id: actorId, entity_type: entityType, entity_id: entityId, action, reason: reason || null, metadata });
  if (error) throw new Error(`Audit record failed: ${error.message}`);
};

export async function submitVerificationAction(fd: FormData) {
  const { supabase, user } = await requirePlatformRoles(["provider_owner", "provider_staff"]);
  const propertyId = String(fd.get("propertyId") ?? "");
  const type = String(fd.get("verificationType") ?? "");
  const evidenceUrl = String(fd.get("evidenceUrl") ?? "").trim();
  const note = String(fd.get("note") ?? "").trim();
  if (!uuid(propertyId) || !["identity", "business_registration", "ownership", "site_visit", "licence", "other"].includes(type)) throw new Error("Invalid verification submission.");
  if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{3,180}$/.test(evidenceUrl) || !evidenceUrl.startsWith(`${propertyId}/`) || evidenceUrl.length > 240 || note.length < 20 || note.length > 1000) throw new Error("Provide the private Storage object path in the format property-uuid/file-name and an explanation of at least 20 characters.");
  const { data: property } = await supabase.from("properties").select("id,slug").eq("id", propertyId).maybeSingle();
  if (!property) throw new Error("Property not found or you do not have access.");
  const { data, error } = await supabase.from("verification_records").insert({ property_id: propertyId, verification_type: type, evidence: [{ reference: evidenceUrl, description: note }], submitted_by: user.id, status: "submitted" }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/trust"); revalidatePath(`/dashboard/properties/${propertyId}`);
  return data.id;
}

export async function respondToReviewAction(fd: FormData) {
  const { supabase } = await requirePlatformRoles(["provider_owner", "provider_staff"]);
  const reviewId = String(fd.get("reviewId") ?? ""); const response = String(fd.get("response") ?? "").trim();
  if (!uuid(reviewId) || response.length < 2 || response.length > 2000) throw new Error("Enter a response between 2 and 2,000 characters.");
  const { error } = await supabase.rpc("respond_to_review", { p_review_id: reviewId, p_response: response });
  if (error) throw new Error(error.message || "Provider response could not be saved.");
  revalidatePath("/dashboard/trust");
}

export async function submitReviewAction(fd: FormData) {
  const { supabase, user, profile } = await requireAuthenticatedUser();
  const propertyId = String(fd.get("propertyId") ?? ""); const name = String(fd.get("displayName") ?? profile.full_name ?? "").trim();
  const rating = Number(fd.get("rating")); const title = String(fd.get("title") ?? "").trim(); const body = String(fd.get("body") ?? "").trim();
  const stayMonthRaw = String(fd.get("stayMonth") ?? "");
  if (!uuid(propertyId) || name.length < 2 || name.length > 60 || !Number.isInteger(rating) || rating < 1 || rating > 5 || body.length < 20 || body.length > 3000) throw new Error("Please complete the review fields.");
  if (!profile.email_verified_at) throw new Error("Verify your email address before submitting a review.");
  const stayMonth = stayMonthRaw ? `${stayMonthRaw}-01` : null;
  const { error } = await supabase.from("reviews").insert({ property_id: propertyId, user_id: user.id, reviewer_display_name: name, rating, title: title || null, body, stay_month: stayMonth, evidence_level: "unverified", status: "pending" });
  if (error) throw new Error(error.message);
  const { data: property } = await supabase.from("properties").select("slug").eq("id", propertyId).maybeSingle();
  if (property?.slug) revalidatePath(`/properties/${property.slug}`);
}

export async function submitListingReportAction(fd: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const propertyId = String(fd.get("propertyId") ?? ""); const reviewId = String(fd.get("reviewId") ?? "");
  const reason = String(fd.get("reason") ?? "other"); const details = String(fd.get("details") ?? "").trim();
  const allowed = ["inaccurate_information", "misleading_photos", "suspected_fraud", "impersonation", "safety_concern", "spam", "harassment", "review_integrity", "other"];
  if ((!uuid(propertyId) && !uuid(reviewId)) || !allowed.includes(reason) || details.length < 20 || details.length > 2000) throw new Error("Please provide a valid report with at least 20 characters of detail.");
  const { error } = await supabase.from("trust_reports").insert({ target_type: reviewId ? "review" : "property", property_id: uuid(propertyId) ? propertyId : null, review_id: uuid(reviewId) ? reviewId : null, reason, details, reporter_id: user?.id ?? null, status: "open" });
  if (error) throw new Error(error.message);
}

export async function moderateReviewAction(fd: FormData) {
  const { supabase, user, profile } = await requirePlatformRoles(["administrator", "editor_moderator"]);
  const reviewId = String(fd.get("reviewId") ?? ""); const decision = String(fd.get("decision") ?? ""); const evidenceLevel = String(fd.get("evidenceLevel") ?? "unverified"); const note = String(fd.get("note") ?? "").trim(); const evidenceNote = String(fd.get("evidenceNote") ?? "").trim();
  if (!uuid(reviewId) || !["published", "rejected", "removed"].includes(decision) || !["unverified", "evidence_supplied", "verified"].includes(evidenceLevel) || note.length < 5 || (evidenceLevel === "verified" && evidenceNote.length < 10)) throw new Error("A valid moderation decision and reason are required.");
  if (profile.role !== "administrator") { const { data } = await supabase.rpc("has_staff_permission", { p_permission_key: "reviews.moderate" }); if (data !== true) throw new Error("Review moderation permission required."); }
  const reviewUpdate: Record<string, unknown> = { status: decision, moderated_by: user.id, moderated_at: new Date().toISOString(), moderation_note: note, evidence_level: evidenceLevel, evidence_note: evidenceLevel === "unverified" ? null : evidenceNote, evidence_verified_by: evidenceLevel === "verified" ? user.id : null, evidence_verified_at: evidenceLevel === "verified" ? new Date().toISOString() : null };
  const { error } = await supabase.from("reviews").update(reviewUpdate).eq("id", reviewId);
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, "review", reviewId, decision, note, { evidence_level: evidenceLevel, evidence_note: evidenceNote || null });
  revalidatePath("/admin/trust"); revalidatePath("/admin/reviews");
}

export async function resolveTrustReportAction(fd: FormData) {
  const { supabase, user } = await requirePlatformRoles(["administrator", "editor_moderator"]);
  const id = String(fd.get("reportId") ?? ""); const status = String(fd.get("status") ?? ""); const note = String(fd.get("note") ?? "").trim();
  if (!uuid(id) || !["investigating", "action_required", "resolved", "dismissed"].includes(status) || note.length < 5) throw new Error("A report status and decision note are required.");
  const { error } = await supabase.from("trust_reports").update({ status, assigned_to: user.id, resolution_note: ["resolved", "dismissed"].includes(status) ? note : null, resolved_by: ["resolved", "dismissed"].includes(status) ? user.id : null, resolved_at: ["resolved", "dismissed"].includes(status) ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, "report", id, status, note);
  revalidatePath("/admin/trust");
}

export async function decideDisputeAction(fd: FormData) {
  const { supabase, user } = await requirePlatformRoles(["administrator", "editor_moderator"]);
  const id = String(fd.get("disputeId") ?? ""); const status = String(fd.get("status") ?? ""); const note = String(fd.get("note") ?? "").trim();
  if (!uuid(id) || !["under_review", "awaiting_information", "upheld", "not_upheld", "closed"].includes(status) || note.length < 5) throw new Error("A dispute decision and reason are required.");
  const { error } = await supabase.from("trust_disputes").update({ status, reviewer_id: ["upheld", "not_upheld", "closed"].includes(status) ? user.id : null, decided_at: ["upheld", "not_upheld", "closed"].includes(status) ? new Date().toISOString() : null, decision_note: note }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, "dispute", id, status, note);
  revalidatePath("/admin/trust");
}

export async function decideVerificationRecordAction(fd: FormData) {
  const { supabase, user } = await requirePlatformRoles(["administrator"]);
  const id = String(fd.get("recordId") ?? ""); const propertyId = String(fd.get("propertyId") ?? "");
  const status = String(fd.get("status") ?? ""); const note = String(fd.get("note") ?? "").trim();
  if (!uuid(id) || !uuid(propertyId) || !["in_review", "verified", "rejected", "expired", "revoked"].includes(status) || note.length < 5) throw new Error("A verification decision and reason are required.");
  const { data, error } = await supabase.rpc("admin_decide_verification_record", { p_record_id: id, p_property_id: propertyId, p_status: status, p_note: note });
  if (error || data !== true) throw new Error(error?.message || "Verification record was not found or could not be updated.");
  revalidatePath("/admin/trust"); revalidatePath("/admin/properties");
}

export async function submitDisputeAction(fd: FormData) {
  const { supabase, user } = await requirePlatformRoles(["provider_owner", "provider_staff"]);
  const propertyId = String(fd.get("propertyId") ?? ""); const subject = String(fd.get("subject") ?? "").trim(); const statement = String(fd.get("statement") ?? "").trim();
  if (!uuid(propertyId) || subject.length < 5 || subject.length > 160 || statement.length < 30 || statement.length > 4000) throw new Error("Provide a subject and a dispute statement of at least 30 characters.");
  const { data, error } = await supabase.from("trust_disputes").insert({ property_id: propertyId, opened_by: user.id, subject, statement, status: "open", evidence: [] }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/trust");
  return data.id;
}
