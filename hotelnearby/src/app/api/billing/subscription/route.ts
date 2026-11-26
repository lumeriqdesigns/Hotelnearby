import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/features/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const schema = z.object({ subscriptionId: z.string().uuid(), action: z.enum(["enable_renewal", "cancel_at_period_end", "schedule_downgrade"]), planCode: z.enum(["starter", "professional", "premium"]).optional() });
export async function POST(request: Request) {
  const context = await getAuthenticatedContext();
  if (!context) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription request." }, { status: 400 });
  const { subscriptionId, action, planCode } = parsed.data;
  const admin = createSupabaseAdminClient();
  const { data: sub } = await admin.from("subscriptions").select("id,organisation_id,current_period_end").eq("id", subscriptionId).maybeSingle();
  if (!sub) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  const { data: member } = await context.supabase.from("provider_memberships").select("role").eq("organisation_id", sub.organisation_id).eq("user_id", context.user.id).maybeSingle();
  if (member?.role !== "owner") return NextResponse.json({ error: "Only the organisation owner can change billing." }, { status: 403 });
  if (action === "enable_renewal") {
    const { data: paymentMethod } = await admin.from("subscription_payment_methods").select("reusable").eq("subscription_id", subscriptionId).maybeSingle();
    if (!paymentMethod?.reusable) return NextResponse.json({ error: "No reusable Paystack authorization is saved. Automatic renewal is not available for this payment method." }, { status: 409 });
    const { error } = await admin.from("subscriptions").update({ auto_renew: true, cancel_at_period_end: false, renewal_consent_at: new Date().toISOString() }).eq("id", subscriptionId);
    if (error) return NextResponse.json({ error: "Could not enable renewal." }, { status: 500 });
  } else if (action === "cancel_at_period_end") {
    const { error } = await admin.from("subscriptions").update({ auto_renew: false, cancel_at_period_end: true, cancelled_at: new Date().toISOString() }).eq("id", subscriptionId);
    if (error) return NextResponse.json({ error: "Could not schedule cancellation." }, { status: 500 });
  } else {
    if (!planCode || !sub.current_period_end) return NextResponse.json({ error: "Select a downgrade plan." }, { status: 400 });
    const { data: target } = await admin.from("subscription_plans").select("id,display_order").eq("code", planCode).single();
    const { data: current } = await admin.from("subscriptions").select("plan_id").eq("id", subscriptionId).single();
    const { data: currentPlan } = await admin.from("subscription_plans").select("display_order").eq("id", current?.plan_id ?? "").single();
    if (!target || target.display_order >= (currentPlan?.display_order ?? 0)) return NextResponse.json({ error: "The selected plan is not a downgrade." }, { status: 400 });
    const { error } = await admin.from("subscriptions").update({ scheduled_plan_id: target.id, scheduled_change_at: sub.current_period_end }).eq("id", subscriptionId);
    if (error) return NextResponse.json({ error: "Could not schedule downgrade." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
