import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/features/auth/authorization";
import { initializeTransaction } from "@/lib/paystack/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env/public";
import { proratedUnusedCredit, proratedPeriodValue } from "@/features/billing/pricing";

const schema = z.object({ propertyId: z.string().uuid(), planCode: z.enum(["professional", "premium"]), interval: z.enum(["monthly", "annual"]) });
export async function POST(request: Request) {
  try {
    const context = await getAuthenticatedContext();
    if (!context || !["provider_owner"].includes(context.profile.role)) return NextResponse.json({ error: "Only an authenticated provider owner can purchase a plan." }, { status: 403 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
    const { propertyId, planCode, interval } = parsed.data;
    const { data: property } = await context.supabase.from("properties").select("id,name,organisation_id").eq("id", propertyId).maybeSingle();
    if (!property) return NextResponse.json({ error: "Property not found or inaccessible." }, { status: 404 });
    const { data: member } = await context.supabase.from("provider_memberships").select("role").eq("organisation_id", property.organisation_id).eq("user_id", context.user.id).maybeSingle();
    if (member?.role !== "owner") return NextResponse.json({ error: "Only an organisation owner can manage billing." }, { status: 403 });
    const { data: plan } = await context.supabase.from("subscription_plans").select("id,code,name").eq("code", planCode).eq("is_active", true).single();
    const { data: price } = await context.supabase.from("plan_prices").select("id,amount_kobo,currency").eq("plan_id", plan?.id ?? "").eq("billing_interval", interval).eq("is_active", true).single();
    if (!plan || !price || price.amount_kobo <= 0) return NextResponse.json({ error: "The selected plan price is unavailable." }, { status: 409 });
    const { data: current } = await context.supabase.from("subscriptions").select("id,plan_id,plan_price_id,billing_interval,current_period_start,current_period_end,status,credit_balance_kobo").eq("property_id", propertyId).in("status", ["active", "grace"]).maybeSingle();
    const admin = createSupabaseAdminClient();
    let subscriptionId = current?.id as string | undefined;
    let credit = 0;
    let amount = Number(price.amount_kobo);
    let purpose: "subscription" | "upgrade" | "renewal" = "subscription";
    if (current) {
      const { data: currentPlan } = await context.supabase.from("subscription_plans").select("code,display_order").eq("id", current.plan_id).single();
      const { data: nextPlan } = await context.supabase.from("subscription_plans").select("display_order").eq("id", plan.id).single();
      const isStarter = currentPlan?.code === "starter";
      const periodExpired = !current.current_period_end || new Date(current.current_period_end) <= new Date();
      if (isStarter) {
        purpose = "subscription";
      } else if (periodExpired) {
        // Manual renewal after expiry may retain the current plan or choose a lower tier.
        purpose = "renewal";
      } else {
        if (current.plan_id === plan.id) return NextResponse.json({ error: "This property already has the selected plan." }, { status: 409 });
        if ((nextPlan?.display_order ?? 0) < (currentPlan?.display_order ?? 0)) return NextResponse.json({ error: "Use the scheduled downgrade option for a lower plan." }, { status: 409 });
        if (current.billing_interval !== interval) return NextResponse.json({ error: "Change billing interval at renewal; immediate upgrades must keep the current billing interval." }, { status: 409 });
        purpose = "upgrade";
        const { data: currentPrice } = await context.supabase.from("plan_prices").select("amount_kobo").eq("id", current.plan_price_id ?? "").maybeSingle();
        if (currentPrice && current.current_period_start && current.current_period_end) {
          const startDate = new Date(current.current_period_start); const endDate = new Date(current.current_period_end); const now = new Date();
          credit = proratedUnusedCredit(Number(currentPrice.amount_kobo), startDate, endDate, now) + Number(current.credit_balance_kobo ?? 0);
          amount = proratedPeriodValue(Number(price.amount_kobo), startDate, endDate, now);
        }
      }
        } else {
      const { data: pending } = await context.supabase.from("subscriptions").select("id").eq("property_id", propertyId).eq("status", "pending_payment").maybeSingle();
      if (pending) return NextResponse.json({ error: "A checkout is already pending for this property. Complete it or contact support." }, { status: 409 });
      const { data: created, error } = await admin.from("subscriptions").insert({ property_id: propertyId, organisation_id: property.organisation_id, plan_id: plan.id, plan_price_id: price.id, status: "pending_payment", billing_interval: interval, auto_renew: false }).select("id").single();
      if (error || !created) throw new Error("Could not prepare the subscription. Confirm billing migrations have been applied.");
      subscriptionId = created.id;
    }
    if (amount - credit <= 0) {
      if (!current || !subscriptionId) throw new Error("Invalid zero-value checkout.");
      const { error } = await admin.from("subscriptions").update({ plan_id: plan.id, plan_price_id: price.id, billing_interval: interval, credit_balance_kobo: Math.max(0, credit - amount) }).eq("id", subscriptionId);
      if (error) throw error;
      return NextResponse.json({ activated: true, message: "Your plan has been upgraded using available unused-value credit." });
    }
    const reference = `HN-${randomUUID().replaceAll("-", "")}`;
    const { data: settings } = await context.supabase.from("platform_billing_settings").select("tax_rate_basis_points,processing_fee_basis_points,processing_fee_fixed_kobo").eq("id", true).maybeSingle();
    const net = amount - credit;
    const processingFee = Math.floor(net * Number(settings?.processing_fee_basis_points ?? 0) / 10000) + Number(settings?.processing_fee_fixed_kobo ?? 0);
    const tax = settings?.tax_rate_basis_points == null ? 0 : Math.floor(net * Number(settings.tax_rate_basis_points) / 10000);
    const total = net + processingFee + tax;
    const { data: payment, error: paymentError } = await admin.from("subscription_payments").insert({ organisation_id: property.organisation_id, purpose, subscription_id: subscriptionId, reference, idempotency_key: reference, amount_kobo: amount, processing_fee_kobo: processingFee, tax_kobo: tax, credit_applied_kobo: credit, billing_metadata: { plan_id: plan.id, plan_price_id: price.id, plan_code: planCode, interval, billing_email: context.user.email ?? context.profile.email ?? "", period_start: new Date().toISOString() }, status: "initiated" }).select("id").single();
    if (paymentError || !payment) throw new Error("Could not create payment record.");
    const { siteUrl } = getPublicEnv();
    const checkout = await initializeTransaction({ email: context.user.email ?? context.profile.email ?? "", amount: total, reference, callback_url: `${siteUrl}/dashboard/billing?reference=${encodeURIComponent(reference)}`, metadata: { payment_id: payment.id, subscription_id: subscriptionId, property_id: propertyId, purpose, plan_code: planCode, interval, credit_applied_kobo: credit } });
    return NextResponse.json({ authorizationUrl: checkout.authorization_url, reference, breakdown: { planAmountKobo: amount, unusedValueCreditKobo: credit, processingFeeKobo: processingFee, taxKobo: tax, totalKobo: total } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
