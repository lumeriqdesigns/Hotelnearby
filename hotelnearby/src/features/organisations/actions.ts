"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuthenticatedUser, requirePlatformRoles } from "@/features/auth/authorization";

const uuid = z.string().uuid();
const text = (value: FormDataEntryValue | null, max = 160) => String(value ?? "").trim().slice(0, max);
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function providerContext(ownerOnly = false) {
  const context = await requirePlatformRoles(["provider_owner", "provider_staff"]);
  const { data: memberships, error } = await context.supabase
    .from("provider_memberships").select("organisation_id,role")
    .eq("user_id", context.user.id);
  if (error || !memberships?.length) throw new Error("No provider organisation is linked to this account.");
  if (ownerOnly && !memberships.some((item) => item.role === "owner")) throw new Error("Only an organisation owner can perform this action.");
  return { ...context, memberships };
}

async function assertPropertyAccess(supabase: Awaited<ReturnType<typeof providerContext>>["supabase"], propertyId: string) {
  if (!uuid.safeParse(propertyId).success) throw new Error("Invalid property reference.");
  const { data, error } = await supabase.from("properties").select("id,organisation_id,approval_status").eq("id", propertyId).maybeSingle();
  if (error || !data) throw new Error("Property not found or you do not have permission to manage it.");
  return data;
}

async function preparePropertyChildEdit(supabase: Awaited<ReturnType<typeof providerContext>>["supabase"], propertyId: string) {
  const property = await assertPropertyAccess(supabase, propertyId);
  if (property.approval_status === "suspended") throw new Error("This listing is suspended and cannot be edited. Contact platform support.");
  if (property.approval_status === "approved") {
    const { error } = await supabase.from("properties").update({ approval_status: "pending_review" }).eq("id", propertyId);
    if (error) throw new Error("The listing could not be moved into administrator review before editing.");
  }
  return property;
}

export async function updateOrganisationAction(formData: FormData) {
  const { supabase, user, memberships } = await providerContext(true);
  const organisationId = text(formData.get("organisationId"), 36);
  if (!memberships.some((m) => m.organisation_id === organisationId && m.role === "owner")) throw new Error("You do not own this organisation.");
  const name = text(formData.get("name"));
  const contactEmail = text(formData.get("contactEmail"), 254).toLowerCase();
  if (name.length < 2 || (contactEmail && !z.string().email().safeParse(contactEmail).success)) throw new Error("Enter a valid organisation name and contact email.");
  const { error } = await supabase.from("provider_organisations").update({
    name, legal_name: text(formData.get("legalName")) || null, contact_email: contactEmail || null,
    phone_number: text(formData.get("phone"), 32) || null, website_url: text(formData.get("website"), 300) || null,
    address: text(formData.get("address"), 500) || null, description: text(formData.get("description"), 2000) || null,
    updated_by: user.id,
  }).eq("id", organisationId);
  if (error) throw new Error("Organisation profile could not be saved.");
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=organisation");
}

export async function createPropertyAction(formData: FormData) {
  const { supabase, memberships } = await providerContext();
  const organisationId = text(formData.get("organisationId"), 36);
  if (!memberships.some((m) => m.organisation_id === organisationId)) throw new Error("Select an organisation you belong to.");
  const name = text(formData.get("name"));
  const locationId = text(formData.get("locationId"), 36);
  const category = text(formData.get("category"), 40);
  if (name.length < 2 || !uuid.safeParse(locationId).success || !["hotel","serviced-apartment","shortlet","guest-house","lodge","resort","boutique-stay","hostel","villa","holiday-home"].includes(category)) throw new Error("Enter a property name, category and valid location.");
  const slug = `${slugify(name) || "property"}-${randomBytes(3).toString("hex")}`;
  const { data, error } = await supabase.from("properties").insert({
    organisation_id: organisationId, location_id: locationId, name, slug, category,
    description: "", approval_status: "draft", verification_status: "unverified", is_active: true,
  }).select("id").single();
  if (error || !data) throw new Error("Property draft could not be created. Check that the Prompt 10 migration is applied.");
  revalidatePath("/dashboard");
  redirect(`/dashboard/properties/${data.id}`);
}

export async function updatePropertyAction(formData: FormData) {
  const { supabase } = await providerContext();
  const propertyId = text(formData.get("propertyId"), 36);
  const existing = await assertPropertyAccess(supabase, propertyId);
  if (existing.approval_status === "suspended") throw new Error("This listing is suspended and cannot be edited. Contact platform support.");
  const name = text(formData.get("name"));
  const category = text(formData.get("category"), 40);
  const locationId = text(formData.get("locationId"), 36);
  const priceRaw = text(formData.get("priceAmount"), 32);
  const priceAmount = priceRaw ? Number(priceRaw) : null;
  const priceBasis = text(formData.get("priceBasis"), 20) || null;
  const bedroomsRaw = text(formData.get("bedrooms"), 8);
  const bathroomsRaw = text(formData.get("bathrooms"), 8);
  const capacityRaw = text(formData.get("guestCapacity"), 8);
  const amenities = text(formData.get("amenities"), 1000).split(",").map((v) => v.trim()).filter(Boolean).slice(0, 40);
  const features = text(formData.get("features"), 1000).split(",").map((v) => v.trim()).filter(Boolean).slice(0, 40);
  if (name.length < 2 || !uuid.safeParse(locationId).success || !Number.isFinite(priceAmount ?? 0) || (priceAmount !== null && priceAmount < 0)) throw new Error("Check the property name, location and price.");
  if (priceBasis && !["night","day","week","month","stay","other"].includes(priceBasis)) throw new Error("Choose a supported pricing basis.");
  const { error } = await supabase.from("properties").update({
    name, category, location_id: locationId, description: text(formData.get("description"), 5000),
    address_line: text(formData.get("address"), 500) || null,
    price_amount: priceAmount, price_basis: priceBasis,
    bedrooms: bedroomsRaw ? Number(bedroomsRaw) : null, bathrooms: bathroomsRaw ? Number(bathroomsRaw) : null,
    guest_capacity: capacityRaw ? Number(capacityRaw) : null,
    amenities, features,
    cover_image_url: text(formData.get("coverImage"), 1000) || null,
    phone_number: text(formData.get("phone"), 32) || null,
    whatsapp_number: text(formData.get("whatsapp"), 32) || null,
    contact_email: text(formData.get("contactEmail"), 254) || null,
    website_url: text(formData.get("website"), 500) || null,
    house_rules: text(formData.get("houseRules"), 3000) || null,
    check_in_information: text(formData.get("checkIn"), 500) || null,
    check_out_information: text(formData.get("checkOut"), 500) || null,
    is_active: formData.get("isActive") === "on",
    ...(existing.approval_status === "approved" ? { approval_status: "pending_review" } : {}),
  }).eq("id", propertyId);
  if (error) throw new Error("Property could not be saved. Submitted listings may require admin review before further changes.");
  revalidatePath("/dashboard"); revalidatePath(`/dashboard/properties/${propertyId}`);
  redirect(`/dashboard/properties/${propertyId}?saved=1`);
}

export async function deletePropertyAction(formData: FormData) {
  const { supabase } = await providerContext();
  const propertyId = text(formData.get("propertyId"), 36);
  await assertPropertyAccess(supabase, propertyId);
  const { error } = await supabase.from("properties").delete().eq("id", propertyId);
  if (error) throw new Error("Property could not be deleted.");
  revalidatePath("/dashboard"); redirect("/dashboard?deleted=1");
}

export async function submitPropertyAction(formData: FormData) {
  const { supabase } = await providerContext();
  const propertyId = text(formData.get("propertyId"), 36);
  const property = await assertPropertyAccess(supabase, propertyId);
  const { data, error } = await supabase.from("properties").select("name,category,location_id,description,address_line,cover_image_url,phone_number,price_amount,price_basis,amenities").eq("id", propertyId).single();
  if (error || !data) throw new Error("Could not check listing completeness.");
  const required = [data.name, data.category, data.location_id, data.description, data.address_line, data.cover_image_url, data.phone_number, data.price_amount, data.price_basis, data.amenities];
  const complete = required.filter((value) => value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0)).length;
  if (complete < 9) throw new Error("Complete at least 9 of the 10 core listing details before submission.");
  if (!["draft","rejected","correction_requested"].includes(property.approval_status)) throw new Error("This listing is already submitted or has been approved.");
  const { error: updateError } = await supabase.from("properties").update({ approval_status: "pending_review" }).eq("id", propertyId);
  if (updateError) throw new Error("Submission failed. Only draft or returned-for-correction listings can be submitted.");
  revalidatePath("/dashboard"); revalidatePath(`/dashboard/properties/${propertyId}`);
  redirect(`/dashboard/properties/${propertyId}?submitted=1`);
}

export async function saveOfferingAction(formData: FormData) {
  const { supabase } = await providerContext();
  const propertyId = text(formData.get("propertyId"), 36);
  await preparePropertyChildEdit(supabase, propertyId);
  const kind = text(formData.get("kind"), 20);
  const id = text(formData.get("id"), 36);
  const name = text(formData.get("name"));
  const price = text(formData.get("price"), 32);
  const basis = text(formData.get("basis"), 20);
  if (!name || name.length < 2 || (price && (!Number.isFinite(Number(price)) || Number(price) < 0)) || !["night","day","week","month","stay","other"].includes(basis)) throw new Error("Enter a valid room/unit name, price and pricing basis.");
  if (!["room","unit"].includes(kind)) throw new Error("Choose a room category or apartment unit.");
  const common = { property_id: propertyId, description: text(formData.get("description"), 1200), price_amount: price ? Number(price) : null, price_basis: basis, guest_capacity: Number(text(formData.get("capacity"), 6)) || null, bedrooms: Number(text(formData.get("bedrooms"), 6)) || null, bathrooms: Number(text(formData.get("bathrooms"), 6)) || null };
  const result = kind === "room"
    ? (id && uuid.safeParse(id).success
      ? await supabase.from("property_room_categories").update({ ...common, name }).eq("id", id).eq("property_id", propertyId)
      : await supabase.from("property_room_categories").insert({ ...common, name }))
    : (id && uuid.safeParse(id).success
      ? await supabase.from("property_apartment_units").update({ ...common, unit_name: name }).eq("id", id).eq("property_id", propertyId)
      : await supabase.from("property_apartment_units").insert({ ...common, unit_name: name }));
  if (result.error) throw new Error("Room category or apartment unit could not be saved.");
  revalidatePath(`/dashboard/properties/${propertyId}`); redirect(`/dashboard/properties/${propertyId}?offering=saved`);
}

export async function deleteOfferingAction(formData: FormData) {
  const { supabase } = await providerContext();
  const propertyId = text(formData.get("propertyId"), 36); await preparePropertyChildEdit(supabase, propertyId);
  const id = text(formData.get("id"), 36); const kind = text(formData.get("kind"), 20);
  if (!uuid.safeParse(id).success || !["room","unit"].includes(kind)) throw new Error("Invalid offering reference.");
  const table = kind === "room" ? "property_room_categories" : "property_apartment_units";
  const { error } = await supabase.from(table).delete().eq("id", id).eq("property_id", propertyId);
  if (error) throw new Error("Room or unit could not be removed.");
  revalidatePath(`/dashboard/properties/${propertyId}`); redirect(`/dashboard/properties/${propertyId}?offering=deleted`);
}

export async function saveMediaAction(formData: FormData) {
  const { supabase } = await providerContext();
  const propertyId = text(formData.get("propertyId"), 36); await preparePropertyChildEdit(supabase, propertyId);
  const mediaType = text(formData.get("mediaType"), 10); const url = text(formData.get("url"), 1000);
  if (!["image","video"].includes(mediaType) || !/^https:\/\//i.test(url)) throw new Error("Provide an HTTPS image or video URL.");
  const { error } = await supabase.from("property_media").insert({ property_id: propertyId, media_type: mediaType, media_url: url, alt_text: text(formData.get("alt"), 200), caption: text(formData.get("caption"), 300) });
  if (error) throw new Error("Media could not be added. Check your permissions and plan limits.");
  revalidatePath(`/dashboard/properties/${propertyId}`); redirect(`/dashboard/properties/${propertyId}?media=saved`);
}

export async function deleteMediaAction(formData: FormData) {
  const { supabase } = await providerContext(); const propertyId = text(formData.get("propertyId"), 36);
  await preparePropertyChildEdit(supabase, propertyId); const id = text(formData.get("id"), 36);
  const { error } = await supabase.from("property_media").delete().eq("id", id).eq("property_id", propertyId);
  if (error) throw new Error("Media could not be removed.");
  revalidatePath(`/dashboard/properties/${propertyId}`); redirect(`/dashboard/properties/${propertyId}?media=deleted`);
}

export async function updateEnquiryStatusAction(formData: FormData) {
  const { supabase } = await providerContext(); const enquiryId = text(formData.get("enquiryId"), 36);
  const propertyId = text(formData.get("propertyId"), 36); await assertPropertyAccess(supabase, propertyId);
  const status = text(formData.get("status"), 20);
  if (!uuid.safeParse(enquiryId).success || !["new","read","closed"].includes(status)) throw new Error("Invalid enquiry status.");
  const { error } = await supabase.from("property_enquiries").update({ status }).eq("id", enquiryId).eq("property_id", propertyId);
  if (error) throw new Error("Enquiry status could not be updated.");
  revalidatePath("/dashboard"); redirect("/dashboard?enquiry=updated");
}

export async function createTeamInvitationAction(formData: FormData) {
  const { supabase, user, memberships } = await providerContext(true);
  const organisationId = text(formData.get("organisationId"), 36);
  if (!memberships.some((m) => m.organisation_id === organisationId && m.role === "owner")) throw new Error("Only the organisation owner can invite staff.");
  const email = text(formData.get("email"), 254).toLowerCase();
  if (!z.string().email().safeParse(email).success) throw new Error("Enter a valid email address.");
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { error } = await supabase.from("provider_invitations").insert({ organisation_id: organisationId, email, token_hash: tokenHash, invited_by: user.id, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
  if (error) throw new Error("Invitation could not be created. Check whether this email already has an active invitation.");
  revalidatePath("/dashboard"); redirect(`/dashboard?invite=${encodeURIComponent(rawToken)}`);
}

export async function removeTeamMemberAction(formData: FormData) {
  const { supabase, memberships } = await providerContext(true);
  const organisationId = text(formData.get("organisationId"), 36); const userId = text(formData.get("userId"), 36);
  if (!memberships.some((m) => m.organisation_id === organisationId && m.role === "owner") || !uuid.safeParse(userId).success) throw new Error("You cannot remove this team member.");
  const { error } = await supabase.from("provider_memberships").delete().eq("organisation_id", organisationId).eq("user_id", userId).eq("role", "staff");
  if (error) throw new Error("Team member could not be removed.");
  revalidatePath("/dashboard"); redirect("/dashboard?member=removed");
}

export async function acceptTeamInvitationAction(formData: FormData) {
  const { supabase } = await requireAuthenticatedUser();
  const rawToken = text(formData.get("token"), 128);
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) throw new Error("This invitation link is invalid.");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { data, error } = await supabase.rpc("accept_provider_invitation", { p_token_hash: tokenHash });
  if (error || data !== true) throw new Error("This invitation is expired, already used, or belongs to another email address.");
  revalidatePath("/dashboard"); redirect("/dashboard?invitation=accepted");
}


export async function revokeTeamInvitationAction(formData: FormData) {
  const { supabase, memberships } = await providerContext(true);
  const organisationId = text(formData.get("organisationId"), 36);
  const invitationId = text(formData.get("invitationId"), 36);
  if (!memberships.some((m) => m.organisation_id === organisationId && m.role === "owner") || !uuid.safeParse(invitationId).success) throw new Error("You cannot revoke this invitation.");
  const { error } = await supabase.from("provider_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitationId).eq("organisation_id", organisationId).is("accepted_at", null);
  if (error) throw new Error("Invitation could not be revoked.");
  revalidatePath("/dashboard"); redirect("/dashboard?invitation=revoked");
}

export async function createAiAssistedPropertyDraftAction(formData: FormData) {
  const { supabase, user, memberships } = await providerContext();
  const organisationId = text(formData.get("organisationId"), 36);
  const sessionId = text(formData.get("sessionId"), 36);
  if (!memberships.some((m) => m.organisation_id === organisationId)) throw new Error("Select an organisation you belong to.");
  const { data: session, error: sessionError } = await supabase.from("ai_listing_sessions")
    .select("id,organisation_id,created_by,suggestions,status").eq("id", sessionId).maybeSingle();
  if (sessionError || !session || session.organisation_id !== organisationId || session.created_by !== user.id || session.status !== "in_progress") {
    throw new Error("This AI guide session is unavailable. Start a new guide or continue manually.");
  }
  const name = text(formData.get("name"));
  const category = text(formData.get("category"), 40);
  const locationId = text(formData.get("locationId"), 36);
  const priceRaw = text(formData.get("priceAmount"), 32);
  const priceAmount = priceRaw ? Number(priceRaw) : null;
  const priceBasis = text(formData.get("priceBasis"), 20) || null;
  if (name.length < 2 || !uuid.safeParse(locationId).success || !["hotel","serviced-apartment","shortlet","guest-house","lodge","resort","boutique-stay","hostel","villa","holiday-home"].includes(category)) {
    throw new Error("Enter a property name, choose a category and select a real location from the list.");
  }
  if (priceAmount !== null && (!Number.isFinite(priceAmount) || priceAmount < 0)) throw new Error("Enter a valid price or leave it blank.");
  if (priceBasis && !["night","day","week","month","stay","other"].includes(priceBasis)) throw new Error("Choose an approved pricing basis.");

  const suggestions = (session.suggestions ?? {}) as { descriptionDraft?: string; suggestedAmenities?: string[]; houseRulesDraft?: string };
  const useAiDescription = formData.get("useAiDescription") === "on";
  const description = useAiDescription ? String(suggestions.descriptionDraft ?? "").slice(0, 1800) : text(formData.get("description"), 5000);
  const chosenAmenities = formData.getAll("confirmedAmenity").map((v) => String(v).trim()).filter((v) => (suggestions.suggestedAmenities ?? []).includes(v)).slice(0, 20);
  const providerAmenities = text(formData.get("providerAmenities"), 1000).split(",").map((v) => v.trim()).filter(Boolean).slice(0, 30);
  const slug = `${name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "property"}-${randomBytes(3).toString("hex")}`;
  const { data: property, error } = await supabase.from("properties").insert({
    organisation_id: organisationId, location_id: locationId, name, slug, category,
    description, address_line: text(formData.get("address"), 500) || null,
    price_amount: priceAmount, price_basis: priceBasis,
    amenities: [...new Set([...chosenAmenities, ...providerAmenities])],
    house_rules: formData.get("useAiHouseRules") === "on" ? String(suggestions.houseRulesDraft ?? "").slice(0, 1200) : text(formData.get("houseRules"), 3000) || null,
    approval_status: "draft", verification_status: "unverified", is_active: true,
  }).select("id").single();
  if (error || !property) throw new Error("The AI-assisted draft could not be created. Check that the latest database migrations are applied.");
  await Promise.all([
    supabase.from("ai_listing_sessions").update({ status: "draft_created", property_id: property.id, provider_reviewed_at: new Date().toISOString() }).eq("id", session.id),
    supabase.from("ai_listing_events").insert([
      { session_id: session.id, organisation_id: organisationId, actor_id: user.id, event_type: "provider_reviewed", fields: { reviewed_fields: ["name", "category", "location", "description", "price", "amenities", "house_rules"] } },
      { session_id: session.id, organisation_id: organisationId, actor_id: user.id, event_type: "draft_created", fields: { category, used_ai_description: useAiDescription, used_ai_house_rules: formData.get("useAiHouseRules") === "on", confirmed_amenity_count: chosenAmenities.length, provider_entered_amenity_count: providerAmenities.length } },
    ]),
  ]);
  revalidatePath("/dashboard");
  redirect(`/dashboard/properties/${property.id}?aiDraft=created`);
}
