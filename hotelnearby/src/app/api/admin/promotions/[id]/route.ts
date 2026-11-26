import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/features/auth/authorization";
import { calculatePromotionEndAt, getApprovedPromotionStatus } from "@/features/promotions/rules";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), inventoryId: z.string().uuid(), startsAt: z.string().datetime() }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(5).max(1000) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAuthenticatedContext();
    if (!context || context.profile.role !== "administrator") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    const { supabase, user } = context;
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid promotion." }, { status: 400 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid promotion decision." }, { status: 400 });
    const { data: promotion } = await supabase.from("promotions").select("id,promotion_type,target_location_id,target_category_slug,duration_days,status,starts_at,ends_at,organisation_id").eq("id", id).maybeSingle();
    if (!promotion) return NextResponse.json({ error: "Promotion not found." }, { status: 404 });
    if (promotion.status !== "pending_approval") return NextResponse.json({ error: "Only paid placements awaiting approval can be reviewed." }, { status: 409 });
    const { data: payment } = await supabase.from("subscription_payments").select("id,status").eq("promotion_id", id).eq("purpose", "promotion").maybeSingle();
    if (payment?.status !== "succeeded") return NextResponse.json({ error: "A verified successful payment is required before approval." }, { status: 409 });

    if (parsed.data.action === "reject") {
      const { error } = await supabase.from("promotions").update({ status: "rejected", rejection_reason: parsed.data.reason, approved_by: null, approved_at: null, inventory_id: null }).eq("id", id).eq("status", "pending_approval");
      if (error) throw error;
      const { data: paidPayment } = await supabase.from("subscription_payments").select("id,total_charged_kobo").eq("promotion_id", id).eq("status", "succeeded").single();
      if (paidPayment) {
        const { error: refundError } = await supabase.from("refunds").insert({ payment_id: paidPayment.id, amount_kobo: paidPayment.total_charged_kobo, reason: `Promotional placement rejected: ${parsed.data.reason}`, requested_by: user.id, status: "requested" });
        if (refundError) throw refundError;
      }
      return NextResponse.json({ success: true, status: "rejected", message: "Placement rejected and a full refund request was added to refund administration." });
    }

    const startsAt = new Date(parsed.data.startsAt);
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "The approved start time must be now or in the future." }, { status: 400 });
    const { data: slot } = await supabase.from("promotional_inventory").select("id,slot_type,target_location_id,target_category_slug,is_active").eq("id", parsed.data.inventoryId).maybeSingle();
    if (!slot || !slot.is_active || slot.slot_type !== promotion.promotion_type || slot.target_location_id !== promotion.target_location_id || slot.target_category_slug !== promotion.target_category_slug) return NextResponse.json({ error: "Choose an active inventory slot matching this placement and target." }, { status: 400 });
    const endsAt = calculatePromotionEndAt(startsAt, Number(promotion.duration_days));
    const { error } = await supabase.from("promotions").update({ inventory_id: slot.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), status: getApprovedPromotionStatus(startsAt), approved_by: user.id, approved_at: new Date().toISOString(), rejection_reason: null }).eq("id", id).eq("status", "pending_approval");
    if (error?.code === "23P01") return NextResponse.json({ error: "That exclusive slot already has a placement during the selected dates. Choose another slot or start date." }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ success: true, status: getApprovedPromotionStatus(startsAt), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update promotion." }, { status: 400 });
  }
}
