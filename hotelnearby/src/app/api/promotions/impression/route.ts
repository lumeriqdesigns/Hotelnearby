import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const schema = z.object({ promotionId: z.string().uuid() });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createSupabaseAdminClient(); const now = new Date().toISOString();
  const { data } = await admin.from("promotions").select("id,property_id,target_location_id").eq("id", parsed.data.promotionId).in("status", ["active", "scheduled"]).lte("starts_at", now).gt("ends_at", now).maybeSingle();
  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  const { error } = await admin.from("analytics_events").insert({ event_type: "promotion.impression", promotion_id: data.id, property_id: data.property_id, location_id: data.target_location_id });
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 });
}
