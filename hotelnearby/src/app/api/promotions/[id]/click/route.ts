import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL("/search", request.url));
  const admin = createSupabaseAdminClient(); const now = new Date().toISOString();
  const { data: promotion } = await admin.from("promotions").select("id,property_id,location_id:target_location_id,property:properties(slug)").eq("id", id).in("status", ["active", "scheduled"]).lte("starts_at", now).gt("ends_at", now).maybeSingle();
  const property = Array.isArray(promotion?.property) ? promotion?.property[0] : promotion?.property;
  if (!promotion || !property?.slug) return NextResponse.redirect(new URL("/search", request.url));
  await admin.from("analytics_events").insert({ event_type: "promotion.click", promotion_id: promotion.id, property_id: promotion.property_id, location_id: promotion.location_id ?? null });
  return NextResponse.redirect(new URL(`/properties/${property.slug}`, request.url), 303);
}
