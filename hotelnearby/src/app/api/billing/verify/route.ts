import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/features/auth/authorization";
import { verifyTransaction, type PaystackTransaction } from "@/lib/paystack/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ reference: z.string().min(8).max(120) });
export async function POST(request: Request) {
  try {
    const context = await getAuthenticatedContext();
    if (!context) return NextResponse.json({ error: "Sign in to verify this payment." }, { status: 401 });
    const body = schema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: payment } = await admin.from("subscription_payments").select("*").eq("reference", body.data.reference).maybeSingle();
    if (!payment) return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
    const { data: membership } = await context.supabase.from("provider_memberships").select("role").eq("organisation_id", payment.organisation_id).eq("user_id", context.user.id).maybeSingle();
    if (!membership || membership.role !== "owner") return NextResponse.json({ error: "You cannot access this payment." }, { status: 403 });
    const verified = await verifyTransaction(body.data.reference);
    const expected = Number(payment.total_charged_kobo);
    if (verified.status !== "success" || verified.currency !== "NGN" || Number(verified.amount) !== expected) {
      await admin.from("subscription_payments").update({ status: verified.status === "failed" ? "failed" : "pending", failure_reason: "Paystack verification did not confirm the expected amount and currency." }).eq("id", payment.id).neq("status", "succeeded");
      return NextResponse.json({ status: verified.status, verified: false, message: "Payment is not yet confirmed. Your plan has not been changed." }, { status: 409 });
    }
    const result = await settlePayment(admin, payment, verified);
    return NextResponse.json({ status: "success", verified: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Verification failed." }, { status: 400 });
  }
}

type PaymentRecord = {
  id: string; purpose: string; status: string; organisation_id: string; subscription_id: string | null; promotion_id: string | null;
  reference: string; currency: string; amount_kobo: number; processing_fee_kobo: number; tax_kobo: number;
  credit_applied_kobo: number; total_charged_kobo: number; billing_metadata: Record<string, unknown> | null;
};
export async function settlePayment(admin: ReturnType<typeof createSupabaseAdminClient>, payment: PaymentRecord, verified: PaystackTransaction) {
  const now = new Date();
  const alreadySettled = ["succeeded", "partially_refunded", "refunded"].includes(payment.status);
  const refundableSettlement = payment.status !== "partially_refunded" && payment.status !== "refunded";
  const { data: priorEvent } = await admin.from("payment_events").select("id").eq("payment_id", payment.id).eq("event_type", "payment.verified").maybeSingle();
  const settlementApplied = Boolean(priorEvent);
  if (!alreadySettled) {
    const { error: paymentError } = await admin.from("subscription_payments").update({ status: "succeeded", channel: verified.channel ?? null, paystack_transaction_id: String(verified.id), verified_at: now.toISOString(), verified_amount_kobo: verified.amount, paid_at: verified.paid_at ?? now.toISOString(), failure_reason: null }).eq("id", payment.id).neq("status", "succeeded");
    if (paymentError) throw paymentError;
  }

  if (!settlementApplied && refundableSettlement && payment.purpose === "promotion") {
    const { data: promotion } = await admin.from("promotions").select("id,status").eq("id", payment.promotion_id).single();
    if (promotion && promotion.status === "awaiting_payment") {
      // Payment confirmation does not publish the placement. The provider-requested dates
      // remain provisional until an administrator allocates an exclusive inventory slot.
      await admin.from("promotions").update({ status: "pending_approval" }).eq("id", promotion.id);
    }
  } else if (!settlementApplied && refundableSettlement && payment.subscription_id) {
    const meta = payment.billing_metadata ?? {};
    const { data: existingSubscription } = await admin.from("subscriptions").select("status,current_period_end").eq("id", payment.subscription_id).maybeSingle();
    if (existingSubscription && !["cancelled", "expired"].includes(existingSubscription.status)) {
      const periodStart = meta.period_start ? new Date(String(meta.period_start)) : now;
      const update: Record<string, unknown> = { status: "active", grace_ends_at: null, renewal_failure_count: 0, next_retry_at: null, credit_balance_kobo: 0, scheduled_plan_id: null, scheduled_change_at: null };
      if (payment.purpose === "subscription") update.auto_renew = false;
      if (meta.plan_id) update.plan_id = meta.plan_id;
      if (meta.plan_price_id) update.plan_price_id = meta.plan_price_id;
      if (meta.interval) {
        update.billing_interval = meta.interval;
        if (payment.purpose !== "upgrade") {
          const end = new Date(periodStart);
          if (meta.interval === "annual") end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
          // Never move a subscription period backwards if a later renewal has already settled.
          if (!existingSubscription.current_period_end || new Date(existingSubscription.current_period_end) <= end) {
            update.current_period_start = periodStart.toISOString();
            update.current_period_end = end.toISOString();
          }
        }
      }
      if (verified.customer?.customer_code) update.paystack_customer_code = verified.customer.customer_code;
      await admin.from("subscriptions").update(update).eq("id", payment.subscription_id);
      const billingEmail = verified.customer?.email ?? (meta.billing_email as string | undefined);
      if (verified.authorization?.reusable && verified.authorization.authorization_code && billingEmail) {
        await admin.from("subscription_payment_methods").upsert({
          subscription_id: payment.subscription_id, organisation_id: payment.organisation_id, provider: "paystack",
          authorization: verified.authorization, reusable: true, signature: verified.authorization.signature ?? null,
          billing_email: billingEmail, card_type: verified.authorization.card_type ?? null,
          last4: verified.authorization.last4 ?? null, bank: verified.authorization.bank ?? null,
          exp_month: verified.authorization.exp_month ?? null, exp_year: verified.authorization.exp_year ?? null,
          updated_at: now.toISOString(),
        }, { onConflict: "subscription_id" });
      }
    }
  }

  const { data: existingInvoice } = await admin.from("invoices").select("id,status").eq("payment_id", payment.id).maybeSingle();
  let invoiceId = existingInvoice?.id as string | undefined;
  if (!invoiceId) {
    const { data: invoice } = await admin.from("invoices").insert({ organisation_id: payment.organisation_id, subscription_id: payment.subscription_id, promotion_id: payment.promotion_id, payment_id: payment.id, status: "draft", currency: payment.currency, subtotal_kobo: Number(payment.amount_kobo) - Number(payment.credit_applied_kobo ?? 0), processing_fee_kobo: payment.processing_fee_kobo, tax_kobo: payment.tax_kobo, total_kobo: payment.total_charged_kobo, billing_snapshot: { payment_reference: payment.reference, credit_applied_kobo: payment.credit_applied_kobo } }).select("id").single();
    invoiceId = invoice?.id;
  }
  if (invoiceId && existingInvoice?.status !== "paid" && existingInvoice?.status !== "refunded") {
    const { data: items } = await admin.from("invoice_items").select("id").eq("invoice_id", invoiceId).limit(1);
    if (!items?.length) await admin.from("invoice_items").insert({ invoice_id: invoiceId, description: payment.purpose === "promotion" ? "Hotelnearby promotional placement" : `Hotelnearby platform ${payment.purpose}`, quantity: 1, unit_amount_kobo: Number(payment.amount_kobo) - Number(payment.credit_applied_kobo ?? 0) });
    await admin.from("invoices").update({ status: "paid", issued_at: now.toISOString(), paid_at: now.toISOString() }).eq("id", invoiceId);
  }
  if (!settlementApplied && refundableSettlement) {
    await admin.from("payment_events").insert({ payment_id: payment.id, event_type: "payment.verified", from_status: payment.status, to_status: "succeeded", source: "verify", details: { paystack_transaction_id: verified.id } });
  }
  return { invoiceCreated: Boolean(invoiceId), alreadyProcessed: alreadySettled };
}
