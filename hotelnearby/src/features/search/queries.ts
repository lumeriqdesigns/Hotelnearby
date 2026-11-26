import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";
import type { PropertySearchResult, SearchFilters } from "./types";

export type PropertySearchResponse = {
  configured: boolean;
  available: boolean;
  rows: PropertySearchResult[];
  total: number;
  error?: "search-unavailable";
};

export async function searchPublicProperties(filters: SearchFilters): Promise<PropertySearchResponse> {
  try {
    const env = getPublicEnv();
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      return { configured: false, available: false, rows: [], total: 0 };
    }
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("search_public_properties", {
      p_query: filters.query || null,
      p_category: filters.category || null,
      p_min_price: filters.minPrice,
      p_max_price: filters.maxPrice,
      p_bedrooms: filters.bedrooms,
      p_bathrooms: filters.bathrooms,
      p_guest_capacity: filters.guests,
      p_amenities: filters.amenities.length ? filters.amenities : null,
      p_features: filters.features.length ? filters.features : null,
      p_verification: filters.verification || null,
      p_sort: filters.sort,
      p_page: filters.page,
      p_page_size: 12,
    });

    if (error) return { configured: true, available: false, rows: [], total: 0, error: "search-unavailable" };
    const rows = (data ?? []) as PropertySearchResult[];
    return { configured: true, available: true, rows, total: Number(rows[0]?.total_count ?? 0) };
  } catch {
    return { configured: true, available: false, rows: [], total: 0, error: "search-unavailable" };
  }
}
