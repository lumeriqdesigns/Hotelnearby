import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/features/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRefund, retryRefund } from "@/lib/paystack/client";
const schema = z.object({ refundId: z.string().uuid(), decision: z.enum(["approve", "reject", "retry"]), reason: z.string().min(3).max(1000).optional(), accountNumber: z.string().regex(/^\d{10}$/).optional(), bankId: z.string().min(1).max(20).optional() });
export async function POST(request: Request) {
  const context = await getAuthenticatedContext();
  if (!context || context.profile.role !== "administrator") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid refund decision." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: refund } = await admin.from("refunds").select("id,payment_id,amount_kobo,status,paystack_refund_id").eq("id", parsed.data.refundId).maybeSingle();
  if (!refund) return NextResponse.json({ error: "Refund request not found." }, { status: 404 });
  if (parsed.data.decision === "retry") {
    if (refund.status !== "needs_attention" || !refund.paystack_refund_id || !parsed.data.accountNumber || !parsed.data.bankId) return NextResponse.json({ error: "A needs-attention refund and valid customer bank details are required." }, { status: 409 });
    try {
      const retried = await retryRefund(Number(refund.paystack_refund_id), { currency: "NGN", account_number: parsed.data.accountNumber, bank_id: parsed.data.bankId });
      await admin.from("refunds").update({ status: "processing" }).eq("id", refund.id);
      return NextResponse.json({ success: true, providerStatus: retried.status });
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Refund retry failed." }, { status: 400 }); }
  }
  if (refund.status !== "requested") return NextResponse.json({ error: "Refund request is unavailable or already decided." }, { status: 409 });
  if (parsed.data.decision === "reject") {
    const { error } = await admin.from("refunds").update({ status: "rejected", decided_by: context.user.id, decided_at: new Date().toISOString() }).eq("id", refund.id);
    if (error) return NextResponse.json({ error: "Could not reject refund." }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  const { data: payment } = await admin.from("subscription_payments").select("paystack_transaction_id").eq("id", refund.payment_id).single();
  if (!payment?.paystack_transaction_id) return NextResponse.json({ error: "Verified Paystack transaction ID is missing." }, { status: 409 });
  await admin.from("refunds").update({ status: "processing", decided_by: context.user.id, decided_at: new Date().toISOString() }).eq("id", refund.id);
  try {
    const result = await createRefund({ transaction: payment.paystack_transaction_id, amount: Number(refund.amount_kobo), merchant_note: parsed.data.reason ?? "Hotelnearby platform refund" });
    await admin.from("refunds").update({ status: result.status === "processed" ? "succeeded" : "processing", paystack_refund_reference: result.reference, paystack_refund_id: result.id, processed_at: result.status === "processed" ? new Date().toISOString() : null }).eq("id", refund.id);
    return NextResponse.json({ success: true, providerStatus: result.status });
  } catch (error) {
    await admin.from("refunds").update({ status: "failed" }).eq("id", refund.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Paystack refund failed." }, { status: 400 });
  }
}
