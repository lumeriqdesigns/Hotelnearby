import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/paystack/client";
import { settlePayment } from "@/app/api/billing/verify/route";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("paystack-signature") ?? request.headers.get("x-paystack-signature"))) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  let event: { event?: string; data?: { reference?: string; id?: string | number } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const admin = createSupabaseAdminClient();
  const dedupe = createHash("sha256").update(raw).digest("hex");
  const { data: inserted, error } = await admin.from("webhook_events").insert({ dedupe_key: dedupe, event_type: event.event ?? "unknown", signature_valid: true, payload: event, processing_status: "received" }).select("id").single();
  let webhookId = inserted?.id as string | undefined;
  let attempts = 1;
  if (error?.code === "23505") {
    const { data: prior } = await admin.from("webhook_events").select("id,processing_status,attempts").eq("provider", "paystack").eq("dedupe_key", dedupe).maybeSingle();
    if (!prior) return NextResponse.json({ error: "Could not recover duplicate webhook record." }, { status: 500 });
    if (["processed", "ignored"].includes(prior.processing_status)) return NextResponse.json({ received: true, duplicate: true });
    webhookId = prior.id;
    attempts = Number(prior.attempts ?? 0) + 1;
    await admin.from("webhook_events").update({ processing_status: "received", attempts, error: null }).eq("id", webhookId);
  }
  if (!webhookId || (error && error.code !== "23505")) return NextResponse.json({ error: "Could not record webhook delivery." }, { status: 500 });
  try {
    if (event.event?.startsWith("refund.") && event.data?.reference) {
      const status = event.event === "refund.processed" ? "succeeded" : event.event === "refund.failed" ? "failed" : event.event === "refund.needs-attention" ? "needs_attention" : "processing";
      const { data: refund } = await admin.from("refunds").select("id,payment_id").eq("paystack_refund_reference", event.data.reference).maybeSingle();
      if (refund) {
        await admin.from("refunds").update({ status, processed_at: status === "succeeded" ? new Date().toISOString() : null }).eq("id", refund.id);
        if (status === "succeeded" || status === "failed") {
          const { data: payment } = await admin.from("subscription_payments").select("id,total_charged_kobo").eq("id", refund.payment_id).single();
          const { data: completed } = await admin.from("refunds").select("amount_kobo").eq("payment_id", refund.payment_id).eq("status", "succeeded");
          const totalRefunded = completed?.reduce((sum, row) => sum + Number(row.amount_kobo), 0) ?? 0;
          if (payment) {
            const paymentStatus = totalRefunded >= Number(payment.total_charged_kobo) ? "refunded" : totalRefunded > 0 ? "partially_refunded" : "succeeded";
            await admin.from("subscription_payments").update({ status: paymentStatus }).eq("id", payment.id);
            if (paymentStatus === "refunded") await admin.from("invoices").update({ status: "refunded" }).eq("payment_id", payment.id);
          }
        }
      }
    } else if (event.event === "charge.success" && event.data?.reference) {
      const { data: payment } = await admin.from("subscription_payments").select("*").eq("reference", event.data.reference).maybeSingle();
      if (payment) {
        const verified = await verifyTransaction(event.data.reference);
        if (verified.status === "success" && verified.currency === payment.currency && Number(verified.amount) === Number(payment.total_charged_kobo)) await settlePayment(admin, payment, verified);
      }
    }
    await admin.from("webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString(), attempts }).eq("id", webhookId);
    return NextResponse.json({ received: true });
  } catch (error) {
    await admin.from("webhook_events").update({ processing_status: "failed", attempts, error: error instanceof Error ? error.message.slice(0, 900) : "Processing failed" }).eq("id", webhookId);
    return NextResponse.json({ error: "Webhook processing failed; retry delivery." }, { status: 500 });
  }
}
