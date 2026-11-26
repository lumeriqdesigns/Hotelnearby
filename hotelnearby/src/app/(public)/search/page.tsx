import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { searchPublicProperties } from "@/features/search/queries";
import { PromotionRail } from "@/features/promotions/promotion-rail";
import {
  accommodationCategories,
  amenityOptions,
  featureOptions,
  type SearchFilters,
} from "@/features/search/types";

export const metadata: Metadata = {
  title: "Search accommodation across Nigeria | Hotelnearby",
  description:
    "Find hotels, serviced apartments, shortlets and other accommodation across Nigeria. Compare property details and contact providers directly.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function positiveNumber(value: string | string[] | undefined): number | null {
  const raw = first(value).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function positiveInteger(value: string | string[] | undefined): number | null {
  const parsed = positiveNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function values(value: string | string[] | undefined, allowed: readonly string[]): string[] {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(selected.filter((item) => allowed.includes(item)))];
}

function readFilters(params: Record<string, string | string[] | undefined>): SearchFilters {
  const minPrice = positiveNumber(params.minPrice);
  const requestedMax = positiveNumber(params.maxPrice);
  const maxPrice = requestedMax;
  const sortValue = first(params.sort);
  const allowedSorts = ["relevance", "lowest-price", "highest-price", "recently-updated", "newest"];
  const pageValue = positiveInteger(params.page) ?? 1;
  const categoryValue = first(params.category);

  return {
    query: first(params.q || params.location).trim().slice(0, 120),
    category: accommodationCategories.some((item) => item.value === categoryValue) ? categoryValue : "",
    minPrice,
    maxPrice,
    bedrooms: positiveInteger(params.bedrooms),
    bathrooms: positiveNumber(params.bathrooms),
    guests: positiveInteger(params.guests),
    amenities: values(params.amenity, amenityOptions.map(([slug]) => slug)),
    features: values(params.feature, featureOptions.map(([slug]) => slug)),
    verification: ["verified", "unverified"].includes(first(params.verification)) ? first(params.verification) : "",
    sort: allowedSorts.includes(sortValue) ? sortValue : "relevance",
    page: Math.min(pageValue, 10000),
  };
}

function buildPageUrl(filters: SearchFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.category) params.set("category", filters.category);
  if (filters.minPrice !== null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.bedrooms !== null) params.set("bedrooms", String(filters.bedrooms));
  if (filters.bathrooms !== null) params.set("bathrooms", String(filters.bathrooms));
  if (filters.guests !== null) params.set("guests", String(filters.guests));
  for (const amenity of filters.amenities) params.append("amenity", amenity);
  for (const feature of filters.features) params.append("feature", feature);
  if (filters.verification) params.set("verification", filters.verification);
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

function formatPrice(amount: number | null, basis: string | null): string {
  if (amount === null) return "Contact property for price";
  const formatted = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
  const basisLabel = basis ? ` / ${basis === "night" ? "night" : basis}` : "";
  return `${formatted}${basisLabel}`;
}

function labelForCategory(value: string): string {
  return accommodationCategories.find((item) => item.value === value)?.label ?? value;
}

function FilterCheckboxes({
  title,
  name,
  options,
  selected,
}: {
  title: string;
  name: string;
  options: readonly (readonly [string, string])[];
  selected: string[];
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-bold">{title}</legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {options.map(([value, label]) => (
          <label key={value} className="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name={name}
              value={value}
              defaultChecked={selected.includes(value)}
              className="size-4 rounded border-input-border accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = readFilters(params);
  const result = await searchPublicProperties(filters);
  const totalPages = Math.ceil(result.total / 12);
  const showingFrom = result.total === 0 ? 0 : (filters.page - 1) * 12 + 1;
  const showingTo = Math.min(filters.page * 12, result.total);

  return (
    <>
      <Section tone="brand" spacing="md">
        <Container>
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-surface-accent">Discover accommodation</p>
          <Heading as="h1" size="display" className="mt-3 text-white">Find a place that fits your stay.</Heading>
          <Text className="mt-3 max-w-2xl text-brand-surface-muted">
            Search real accommodation listings across Nigeria. Contact each property directly to confirm its current price and availability.
          </Text>
        </Container>
      </Section>

      {filters.category ? <PromotionRail types={["category"]} categorySlug={filters.category} title={`Sponsored ${labelForCategory(filters.category)} listings`} /> : null}
      <Section spacing="lg">
        <Container>
          <div className="grid items-start gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside aria-label="Accommodation filters" className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <Heading as="h2" size="h3">Filter results</Heading>
                <Link href="/search" className="text-sm font-bold text-accent-text underline underline-offset-4">Reset all</Link>
              </div>
              <form action="/search" method="get" className="mt-5 grid gap-5">
                <label className="grid gap-1.5 text-sm font-semibold" htmlFor="search-q">
                  Property or location
                  <input id="search-q" name="q" type="search" maxLength={120} defaultValue={filters.query} placeholder="Name, state, city, area or landmark" className="min-h-11 rounded-lg border border-input-border bg-background px-3 font-normal" />
                </label>

                <label className="grid gap-1.5 text-sm font-semibold" htmlFor="search-category">
                  Accommodation type
                  <select id="search-category" name="category" defaultValue={filters.category} className="min-h-11 rounded-lg border border-input-border bg-background px-3 font-normal">
                    <option value="">All accommodation types</option>
                    {accommodationCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </label>

                <fieldset className="grid gap-2">
                  <legend className="text-sm font-bold">Price range (₦)</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-xs text-muted-foreground" htmlFor="min-price">Minimum
                      <input id="min-price" name="minPrice" type="number" min="0" step="100" inputMode="numeric" defaultValue={filters.minPrice ?? ""} placeholder="No minimum" className="min-h-10 w-full rounded-lg border border-input-border bg-background px-2 text-sm text-foreground" />
                    </label>
                    <label className="grid gap-1 text-xs text-muted-foreground" htmlFor="max-price">Maximum
                      <input id="max-price" name="maxPrice" type="number" min="0" step="100" inputMode="numeric" defaultValue={filters.maxPrice ?? ""} placeholder="No maximum" className="min-h-10 w-full rounded-lg border border-input-border bg-background px-2 text-sm text-foreground" />
                    </label>
                  </div>
                </fieldset>

                <div className="grid grid-cols-3 gap-2">
                  <label className="grid gap-1 text-xs font-semibold" htmlFor="bedrooms">Bedrooms
                    <input id="bedrooms" name="bedrooms" type="number" min="0" max="100" defaultValue={filters.bedrooms ?? ""} className="min-h-10 w-full rounded-lg border border-input-border bg-background px-2 text-sm" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold" htmlFor="bathrooms">Bathrooms
                    <input id="bathrooms" name="bathrooms" type="number" min="0" max="100" step="0.5" defaultValue={filters.bathrooms ?? ""} className="min-h-10 w-full rounded-lg border border-input-border bg-background px-2 text-sm" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold" htmlFor="guests">Guests
                    <input id="guests" name="guests" type="number" min="1" max="100" defaultValue={filters.guests ?? ""} className="min-h-10 w-full rounded-lg border border-input-border bg-background px-2 text-sm" />
                  </label>
                </div>

                <FilterCheckboxes title="Facilities and amenities" name="amenity" options={amenityOptions} selected={filters.amenities} />
                <FilterCheckboxes title="Property features" name="feature" options={featureOptions} selected={filters.features} />

                <label className="grid gap-1.5 text-sm font-semibold" htmlFor="verification">
                  Verification
                  <select id="verification" name="verification" defaultValue={filters.verification} className="min-h-11 rounded-lg border border-input-border bg-background px-3 font-normal">
                    <option value="">All statuses</option>
                    <option value="verified">Verified only</option>
                    <option value="unverified">Not verified</option>
                  </select>
                </label>

                <label className="grid gap-1.5 text-sm font-semibold" htmlFor="sort-mobile">
                  Sort by
                  <select id="sort-mobile" name="sort" defaultValue={filters.sort} className="min-h-11 rounded-lg border border-input-border bg-background px-3 font-normal">
                    <option value="relevance">Relevance</option>
                    <option value="lowest-price">Lowest price</option>
                    <option value="highest-price">Highest price</option>
                    <option value="recently-updated">Recently updated</option>
                    <option value="newest">Newly listed</option>
                  </select>
                </label>
                <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-extrabold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Apply filters</button>
              </form>
            </aside>

            <div className="min-w-0">
              <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-end">
                <div>
                  <Heading as="h2" size="h2">Accommodation results</Heading>
                  <Text tone="muted" size="small" className="mt-1">
                    {result.available ? `${showingFrom.toLocaleString("en-NG")}–${showingTo.toLocaleString("en-NG")} of ${result.total.toLocaleString("en-NG")} approved properties` : "Live results will appear when the search database is connected."}
                  </Text>
                </div>
                <form action="/search" method="get" className="flex flex-wrap items-center gap-2">
                  {filters.query && <input type="hidden" name="q" value={filters.query} />}
                  {filters.category && <input type="hidden" name="category" value={filters.category} />}
                  {filters.minPrice !== null && <input type="hidden" name="minPrice" value={filters.minPrice} />}
                  {filters.maxPrice !== null && <input type="hidden" name="maxPrice" value={filters.maxPrice} />}
                  {filters.bedrooms !== null && <input type="hidden" name="bedrooms" value={filters.bedrooms} />}
                  {filters.bathrooms !== null && <input type="hidden" name="bathrooms" value={filters.bathrooms} />}
                  {filters.guests !== null && <input type="hidden" name="guests" value={filters.guests} />}
                  {filters.amenities.map((item) => <input key={item} type="hidden" name="amenity" value={item} />)}
                  {filters.features.map((item) => <input key={item} type="hidden" name="feature" value={item} />)}
                  {filters.verification && <input type="hidden" name="verification" value={filters.verification} />}
                  <label htmlFor="sort-results" className="text-sm font-semibold">Sort</label>
                  <select id="sort-results" name="sort" defaultValue={filters.sort} className="min-h-10 rounded-lg border border-input-border bg-background px-3 text-sm">
                    <option value="relevance">Relevance</option>
                    <option value="lowest-price">Lowest price</option>
                    <option value="highest-price">Highest price</option>
                    <option value="recently-updated">Recently updated</option>
                    <option value="newest">Newly listed</option>
                  </select>
                  <button type="submit" className="min-h-10 rounded-lg border border-input-border px-3 text-sm font-bold hover:bg-surface-muted">Apply</button>
                </form>
              </div>

              {!result.configured ? (
                <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center">
                  <span aria-hidden="true" className="text-3xl">⌕</span>
                  <Heading as="h3" size="h3" className="mt-3">Search database not connected yet</Heading>
                  <Text tone="muted" className="mx-auto mt-2 max-w-xl">Connect the approved Supabase project and apply the accommodation search migration. We will not display sample properties in place of real listings.</Text>
                </div>
              ) : !result.available ? (
                <div role="alert" className="mt-6 rounded-2xl border border-border bg-surface-muted p-8 text-center">
                  <Heading as="h3" size="h3">We could not load search results</Heading>
                  <Text tone="muted" className="mt-2">The search service is temporarily unavailable or its database migration has not been applied. Please try again later.</Text>
                </div>
              ) : result.rows.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center">
                  <span aria-hidden="true" className="text-3xl">⌕</span>
                  <Heading as="h3" size="h3" className="mt-3">No matching accommodation found</Heading>
                  <Text tone="muted" className="mx-auto mt-2 max-w-xl">Try a broader location, remove one or more filters, or increase your price range. Only approved active properties appear in public search.</Text>
                  <Link href="/search" className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-input-border px-5 text-sm font-bold hover:bg-background">Clear all filters</Link>
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-4">
                    {result.rows.map((property) => {
                      const location = [property.neighbourhood_name, property.city_name, property.state_name].filter(Boolean).join(", ");
                      return (
                        <article key={property.id} className="grid overflow-hidden rounded-2xl border border-border bg-surface sm:grid-cols-[190px_minmax(0,1fr)]">
                          <div className="min-h-40 bg-surface-muted sm:min-h-full">
                            {property.cover_image_url ? (
                              // Property images are provider-supplied URLs; the public view only exposes approved listings.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={property.cover_image_url} alt={`${property.name} accommodation`} loading="lazy" className="h-full min-h-40 w-full object-cover" />
                            ) : <div className="flex h-full min-h-40 items-center justify-center text-4xl text-accent-text" aria-hidden="true">⌂</div>}
                          </div>
                          <div className="flex flex-col justify-between gap-4 p-5">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-accent-text">{labelForCategory(property.category)}</span>
                                {property.verification_status === "verified" && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">Verified</span>}
                              </div>
                              <h3 className="mt-3 text-lg font-extrabold"><Link href={`/properties/${property.slug}`} className="underline-offset-4 hover:text-accent-text hover:underline">{property.name}</Link></h3>
                              {location && <p className="mt-1 text-sm text-muted-foreground">{location}</p>}
                              {property.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{property.description}</p>}
                            </div>
                            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
                              <div>
                                <p className="font-extrabold text-primary">{formatPrice(property.price_amount, property.price_basis)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {[property.bedrooms !== null ? `${property.bedrooms} bed` : null, property.bathrooms !== null ? `${property.bathrooms} bath` : null, property.guest_capacity !== null ? `Up to ${property.guest_capacity} guests` : null].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">Contact the property to confirm details</p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <nav aria-label="Search result pages" className="mt-7 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">Page {filters.page} of {totalPages}</p>
                      <div className="flex gap-2">
                        {filters.page > 1 && <Link rel="prev" href={buildPageUrl(filters, filters.page - 1)} className="inline-flex min-h-10 items-center rounded-lg border border-input-border px-4 text-sm font-bold hover:bg-surface-muted">Previous</Link>}
                        {filters.page < totalPages && <Link rel="next" href={buildPageUrl(filters, filters.page + 1)} className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-hover">Next page</Link>}
                      </div>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
