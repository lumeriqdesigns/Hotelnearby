import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/features/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const schema = z.object({ paymentId: z.string().uuid(), amountKobo: z.number().int().positive(), reason: z.string().min(3).max(1000) });
export async function POST(request: Request) {
  const context = await getAuthenticatedContext(); if (!context) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid refund request." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: payment } = await admin.from("subscription_payments").select("id,organisation_id,total_charged_kobo,status").eq("id", parsed.data.paymentId).maybeSingle();
  if (!payment || !["succeeded", "partially_refunded"].includes(payment.status) || parsed.data.amountKobo > Number(payment.total_charged_kobo)) return NextResponse.json({ error: "This payment cannot be refunded for the requested amount." }, { status: 409 });
  const { data: member } = await context.supabase.from("provider_memberships").select("role").eq("organisation_id", payment.organisation_id).eq("user_id", context.user.id).maybeSingle();
  if (member?.role !== "owner") return NextResponse.json({ error: "Only the organisation owner can request a refund." }, { status: 403 });
  const { data, error } = await admin.from("refunds").insert({ payment_id: payment.id, amount_kobo: parsed.data.amountKobo, reason: parsed.data.reason, requested_by: context.user.id, status: "requested" }).select("id,status").single();
  if (error || !data) return NextResponse.json({ error: "Could not submit refund request." }, { status: 400 });
  return NextResponse.json({ success: true, refund: data });
}
