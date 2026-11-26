import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/features/auth/authorization";
import { initializeTransaction } from "@/lib/paystack/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env/public";
import { calculatePromotionEndAt, isValidPromotionTarget } from "@/features/promotions/rules";

const schema = z.object({ propertyId: z.string().uuid(), type: z.enum(["featured", "homepage", "city", "category"]), durationDays: z.number().int().min(1).max(90), targetLocationId: z.string().uuid().optional(), targetCategorySlug: z.string().min(1).max(80).optional(), requestedStartAt: z.string().datetime().optional() });
export async function POST(request: Request) {
  try {
    const context = await getAuthenticatedContext();
    if (!context || context.profile.role !== "provider_owner") return NextResponse.json({ error: "Provider owner access is required." }, { status: 403 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid promotion request." }, { status: 400 });
    const input = parsed.data;
    if (!isValidPromotionTarget(input.type, input.targetLocationId, input.targetCategorySlug)) return NextResponse.json({ error: "Select the correct city or category target." }, { status: 400 });
    const { data: property } = await context.supabase.from("properties").select("id,organisation_id,approval_status,is_active,city_location_id,category").eq("id", input.propertyId).maybeSingle();
    if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });
    if (property.approval_status !== "approved" || !property.is_active) return NextResponse.json({ error: "Only active, administrator-approved properties can purchase promotional placements." }, { status: 409 });
    const requestedStart = input.requestedStartAt ? new Date(input.requestedStartAt) : new Date();
    if (!Number.isFinite(requestedStart.getTime()) || requestedStart.getTime() < Date.now() - 60_000 || requestedStart.getTime() > Date.now() + 90 * 86400000) return NextResponse.json({ error: "Choose a start date within the next 90 days." }, { status: 400 });
    if (input.type === "city") { if (property.city_location_id !== input.targetLocationId) return NextResponse.json({ error: "City placements must target the city where this property is located." }, { status: 400 }); const { data: target } = await context.supabase.from("location_nodes").select("id,level,is_active").eq("id", input.targetLocationId!).maybeSingle(); if (!target || target.level !== "city_town" || !target.is_active) return NextResponse.json({ error: "Choose an active city or town." }, { status: 400 }); }
    if (input.type === "category") { if (property.category !== input.targetCategorySlug) return NextResponse.json({ error: "Category placements must match this property’s accommodation category." }, { status: 400 }); const { data: target } = await context.supabase.from("accommodation_categories").select("slug,is_active").eq("slug", input.targetCategorySlug!).maybeSingle(); if (!target || !target.is_active) return NextResponse.json({ error: "Choose an active accommodation category." }, { status: 400 }); }
    const { data: membership } = await context.supabase.from("provider_memberships").select("role").eq("organisation_id", property.organisation_id).eq("user_id", context.user.id).maybeSingle();
    if (membership?.role !== "owner") return NextResponse.json({ error: "Only the property organisation owner can purchase promotions." }, { status: 403 });
    const { data: price } = await context.supabase.from("promotion_prices").select("amount_kobo,currency").eq("promotion_type", input.type).eq("duration_days", input.durationDays).eq("is_active", true).single();
    if (!price || price.currency !== "NGN") return NextResponse.json({ error: "This NGN promotion duration is not currently priced. Contact Hotelnearby for a quote." }, { status: 409 });
    const admin = createSupabaseAdminClient();
    let inventoryQuery = admin.from("promotional_inventory").select("id").eq("slot_type", input.type).eq("is_active", true);
    inventoryQuery = input.targetLocationId ? inventoryQuery.eq("target_location_id", input.targetLocationId) : inventoryQuery.is("target_location_id", null);
    inventoryQuery = input.targetCategorySlug ? inventoryQuery.eq("target_category_slug", input.targetCategorySlug) : inventoryQuery.is("target_category_slug", null);
    const { data: candidateSlots, error: slotError } = await inventoryQuery.order("slot_number");
    if (slotError) throw new Error("Could not check promotional inventory.");
    if (!candidateSlots?.length) return NextResponse.json({ error: "No inventory slot is configured for this placement. Please contact Hotelnearby." }, { status: 409 });
    const endsAt = calculatePromotionEndAt(requestedStart, input.durationDays);
    let promotion: { id: string } | null = null; let promotionError: { code?: string } | null = null;
    // The database exclusion constraint is the final concurrency guard. If another checkout
    // reserves the same slot at the same time, try the next matching slot before charging.
    for (const slot of candidateSlots) {
      const result = await admin.from("promotions").insert({ property_id: property.id, organisation_id: property.organisation_id, promotion_type: input.type, target_location_id: input.targetLocationId ?? null, target_category_slug: input.targetCategorySlug ?? null, inventory_id: slot.id, duration_days: input.durationDays, price_kobo: price.amount_kobo, status: "awaiting_payment", starts_at: requestedStart.toISOString(), ends_at: endsAt.toISOString() }).select("id").single();
      if (!result.error && result.data) { promotion = result.data; promotionError = null; break; }
      promotionError = result.error;
      if (result.error?.code !== "23P01") break;
    }
    if (!promotion) {
      if (promotionError?.code === "23P01") return NextResponse.json({ error: "No exclusive slot is available for those dates. Choose a different start date or ask Hotelnearby about additional inventory." }, { status: 409 });
      throw new Error("Could not reserve promotional inventory.");
    }
    const reference = `HNPROMO-${randomUUID().replaceAll("-", "")}`;
    const { data: settings } = await context.supabase.from("platform_billing_settings").select("tax_rate_basis_points,processing_fee_basis_points,processing_fee_fixed_kobo").eq("id", true).maybeSingle();
    const processingFee = Math.floor(Number(price.amount_kobo) * Number(settings?.processing_fee_basis_points ?? 0) / 10000) + Number(settings?.processing_fee_fixed_kobo ?? 0);
    const tax = settings?.tax_rate_basis_points == null ? 0 : Math.floor(Number(price.amount_kobo) * Number(settings.tax_rate_basis_points) / 10000);
    const { data: payment, error: paymentError } = await admin.from("subscription_payments").insert({ organisation_id: property.organisation_id, purpose: "promotion", promotion_id: promotion.id, reference, idempotency_key: reference, amount_kobo: price.amount_kobo, processing_fee_kobo: processingFee, tax_kobo: tax, status: "initiated", billing_metadata: { promotion_type: input.type, duration_days: input.durationDays, requested_start_at: requestedStart.toISOString(), billing_email: context.user.email ?? context.profile.email ?? "" } }).select("id").single();
    if (paymentError || !payment) throw new Error("Could not create promotion payment record.");
    const { siteUrl } = getPublicEnv();
    const checkout = await initializeTransaction({ email: context.user.email ?? context.profile.email ?? "", amount: Number(price.amount_kobo) + processingFee + tax, reference, callback_url: `${siteUrl}/dashboard/billing?reference=${encodeURIComponent(reference)}`, metadata: { payment_id: payment.id, promotion_id: promotion.id, property_id: property.id, purpose: "promotion" } });
    return NextResponse.json({ authorizationUrl: checkout.authorization_url, reference, requestedStartAt: requestedStart.toISOString(), breakdown: { planAmountKobo: Number(price.amount_kobo), unusedValueCreditKobo: 0, processingFeeKobo: processingFee, taxKobo: tax, totalKobo: Number(price.amount_kobo) + processingFee + tax } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to initialize promotion checkout." }, { status: 400 }); }
}
