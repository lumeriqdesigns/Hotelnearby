import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  action: z.enum(["save", "unsave", "recent", "compare", "uncompare", "clear_recent"]),
  propertyId: z.string().uuid().optional(),
  listName: z.string().trim().min(1).max(60).default("Saved"),
});

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ authenticated: false, saved: [], recent: [], compare: [] });
    const [saved, recent, comparison] = await Promise.all([
      supabase.from("saved_properties").select("property_id,list_name,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("recently_viewed").select("property_id,viewed_at,view_count").eq("user_id", user.id).order("viewed_at", { ascending: false }).limit(30),
      supabase.from("comparisons").select("id,name,comparison_items(property_id,position)").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (saved.error || recent.error || comparison.error) return NextResponse.json({ error: "Could not load your travel data." }, { status: 500 });
    const items = (comparison.data?.comparison_items ?? []) as { property_id: string; position: number }[];
    const savedRows = saved.data ?? [];
    const recentRows = recent.data ?? [];
    const compareIds = items.sort((a,b) => a.position-b.position).map((item) => item.property_id);
    const ids = [...new Set([...savedRows.map((item) => item.property_id), ...recentRows.map((item) => item.property_id), ...compareIds])];
    const { data: properties, error: propertyError } = ids.length ? await supabase.from("public_property_search").select("id,name,slug,category,price_amount,price_basis,cover_image_url,city_name,state_name,neighbourhood_name,bedrooms,bathrooms,guest_capacity,amenities,features").in("id", ids) : { data: [], error: null };
    if (propertyError) return NextResponse.json({ error: "Could not load saved property details." }, { status: 500 });
    const { data: coordinates, error: coordinateError } = ids.length ? await supabase.from("properties").select("id,latitude,longitude").in("id", ids) : { data: [], error: null };
    if (coordinateError) return NextResponse.json({ error: "Could not load property coordinates." }, { status: 500 });
    const coordinateMap = new Map((coordinates ?? []).map((item) => [item.id, item]));
    const enriched = (properties ?? []).map((item) => ({ ...item, latitude: coordinateMap.get(item.id)?.latitude ?? null, longitude: coordinateMap.get(item.id)?.longitude ?? null }));
    return NextResponse.json({ authenticated: true, saved: savedRows, recent: recentRows, compare: compareIds, properties: enriched });
  } catch { return NextResponse.json({ error: "Visitor tools are temporarily unavailable." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid visitor-tool request." }, { status: 400 });
  const { action, propertyId, listName } = parsed.data;
  if (["save", "unsave", "recent", "compare", "uncompare"].includes(action) && !propertyId) return NextResponse.json({ error: "A property is required." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to sync this feature across devices." }, { status: 401 });
    if (action === "save") {
      const result = await supabase.from("saved_properties").upsert({ user_id: user.id, property_id: propertyId!, list_name: listName }, { onConflict: "user_id,list_name,property_id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    } else if (action === "unsave") {
      const result = await supabase.from("saved_properties").delete().eq("user_id", user.id).eq("property_id", propertyId!).eq("list_name", listName);
      if (result.error) throw result.error;
    } else if (action === "recent") {
      const result = await supabase.rpc("touch_recently_viewed", { p_property_id: propertyId! });
      if (result.error) throw result.error;
    } else if (action === "compare") {
      let { data: comparison, error } = await supabase.from("comparisons").select("id").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!comparison) {
        const created = await supabase.from("comparisons").insert({ user_id: user.id, name: "My comparison" }).select("id").single();
        if (created.error) throw created.error;
        comparison = created.data;
      }
      const { data: existing, error: existingError } = await supabase.from("comparison_items").select("property_id,position").eq("comparison_id", comparison.id).order("position");
      if (existingError) throw existingError;
      if (!(existing ?? []).some((item) => item.property_id === propertyId)) {
        if ((existing ?? []).length >= 3) return NextResponse.json({ error: "You can compare up to three properties." }, { status: 409 });
        const used = new Set((existing ?? []).map((item) => item.position));
        const position = [1,2,3].find((n) => !used.has(n))!;
        const inserted = await supabase.from("comparison_items").insert({ comparison_id: comparison.id, property_id: propertyId!, position });
        if (inserted.error) throw inserted.error;
      }
    } else if (action === "uncompare") {
      const { data: comparison } = await supabase.from("comparisons").select("id").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (comparison) {
        const result = await supabase.from("comparison_items").delete().eq("comparison_id", comparison.id).eq("property_id", propertyId!);
        if (result.error) throw result.error;
      }
    } else if (action === "clear_recent") {
      const result = await supabase.from("recently_viewed").delete().eq("user_id", user.id);
      if (result.error) throw result.error;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save this change. Please try again." }, { status: 500 });
  }
}
