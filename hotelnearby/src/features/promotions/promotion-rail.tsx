import "server-only";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env/public";
import { PromotionImpression } from "@/features/promotions/promotion-impression";

export async function PromotionRail({ types, citySlug, categorySlug, title = "Sponsored accommodation" }: { types: string[]; citySlug?: string; categorySlug?: string; title?: string }) {
  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await supabase.rpc("get_live_promotional_placements", { p_types: types, p_city_slug: citySlug ?? null, p_category_slug: categorySlug ?? null, p_limit: 8 });
  type LivePromotion = { promotion_id: string; property_name: string; property_category: string };
  const items = (data ?? []) as LivePromotion[];
  if (!items.length) return null;
  return <section className="py-8"><div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-accent-text">Paid placement</p><h2 className="mt-1 text-xl font-extrabold">{title}</h2></div><span className="text-xs text-muted-foreground">Sponsored</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <article key={item.promotion_id} className="rounded-xl border border-border bg-surface p-4"><PromotionImpression promotionId={item.promotion_id}/><span className="inline-flex rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider">Sponsored</span><h3 className="mt-3 font-extrabold">{item.property_name}</h3><p className="mt-1 text-xs text-muted-foreground">{String(item.property_category).replaceAll("-", " ")}</p><Link href={`/api/promotions/${item.promotion_id}/click`} className="mt-4 inline-flex text-sm font-bold text-accent-text underline">View property</Link></article>)}</div><p className="mt-3 text-xs text-muted-foreground">Paid placement is labelled sponsored and does not affect organic search rankings. Performance is not guaranteed.</p></div></section>;
}
