import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { PropertyContactForms } from "@/components/properties/property-contact-forms";
import { PropertyGallery } from "@/components/properties/property-gallery";
import { SharePropertyButton } from "@/components/properties/share-property-button";
import { VisitorPropertyActions } from "@/features/visitor/visitor-property-actions";
import { getPublicPropertyDetail } from "@/features/properties/queries";
import { accommodationCategories } from "@/features/search/types";
import { SITE } from "@/lib/site";
import { getPublicEnv } from "@/lib/env/public";
import type { PropertyOffering } from "@/features/properties/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitReviewAction, submitListingReportAction } from "@/features/trust/actions";

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

function categoryLabel(value: string) {
  return accommodationCategories.find((category) => category.value === value)?.label ?? value;
}
function verificationLabel(value: string) {
  if (value === "verified") return "Verified listing";
  if (value === "pending") return "Verification pending";
  return "Not verified";
}
function formatPrice(amount: number | null, basis: string | null) {
  if (amount === null) return "Contact property for price";
  const formatted = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
  const labels: Record<string, string> = { night: "per night", day: "per day", week: "per week", month: "per month", stay: "per stay", other: "pricing basis confirmed by property" };
  return `${formatted}${basis ? ` ${labels[basis] ?? `per ${basis}`}` : " · pricing basis not provided"}`;
}
function formatDate(value: string | null) {
  if (!value) return "Last price update date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last price update date not provided";
  return `Last price updated ${new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(date)}`;
}
function phoneHref(value: string) { return `tel:${value.replace(/[^+\d]/g, "")}`; }
function whatsappHref(value: string, propertyName: string) {
  const digits = value.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Hello, I found ${propertyName} on Hotelnearby. Please confirm your current price and availability.`)}`;
}
function OfferingCard({ offering, title }: { offering: PropertyOffering; title: string }) {
  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{offering.name}</h3>{offering.description ? <p className="mt-1 text-sm text-muted-foreground">{offering.description}</p> : null}</div><span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold">{title}</span></div>
      <p className="mt-4 text-lg font-extrabold text-primary">{formatPrice(offering.price_amount, offering.price_basis)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{formatDate(offering.price_updated_at)}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{SITE.priceDisclaimer}</p>
      <p className="mt-3 text-sm text-muted-foreground">{[offering.bedrooms !== null ? `${offering.bedrooms} bedroom${offering.bedrooms === 1 ? "" : "s"}` : null, offering.bathrooms !== null ? `${offering.bathrooms} bathroom${offering.bathrooms === 1 ? "" : "s"}` : null, offering.guest_capacity !== null ? `Up to ${offering.guest_capacity} guests` : null].filter(Boolean).join(" · ")}</p>
      {offering.amenities.length ? <p className="mt-2 text-sm text-muted-foreground">{offering.amenities.join(" · ")}</p> : null}
    </article>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPublicPropertyDetail(slug);
  if (!property) return { title: "Accommodation listing | Hotelnearby", robots: { index: false, follow: true } };
  const location = [property.city_name, property.state_name, "Nigeria"].filter(Boolean).join(", ");
  const description = (property.description || `${property.name} in ${location}. View published accommodation details and contact the property directly.`).replace(/\s+/g, " ").slice(0, 160);
  const heroImage = property.media.find((item) => item.type === "image");
  const image = heroImage?.url || property.cover_image_url;
  return {
    title: `${property.name} in ${location} | Hotelnearby`,
    description,
    alternates: { canonical: `/properties/${property.slug}` },
    openGraph: { type: "website", title: `${property.name} in ${location}`, description, url: `/properties/${property.slug}`, images: image ? [{ url: image, alt: heroImage?.alt || property.name }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title: `${property.name} in ${location}`, description, images: image ? [image] : undefined },
    robots: { index: property.description.trim().length >= 80 && (Boolean(image) || property.amenities.length + property.features.length >= 3), follow: true },
  };
}

export default async function PropertyDetailPage({ params }: Props) {
  const { slug } = await params;
  const property = await getPublicPropertyDetail(slug);
  if (!property) notFound();
  const trustClient = await createSupabaseServerClient();
  const [{ data: publicReviews }, { data: reviewStats }] = await Promise.all([
    trustClient.from("public_property_reviews").select("id,reviewer_display_name,rating,title,body,stay_month,evidence_level,provider_response,created_at").eq("property_id", property.id).order("created_at", { ascending: false }).limit(20),
    trustClient.from("property_review_stats").select("review_count,average_rating,verified_review_count").eq("property_id", property.id).maybeSingle(),
  ]);
  const knownLocationParts = [property.address_line, property.neighbourhood_name, property.city_name, property.state_name].filter(Boolean);
  const locationParts = knownLocationParts.length ? [...knownLocationParts, "Nigeria"] : [];
  const location = [property.city_name, property.state_name].filter(Boolean).join(", ");
  const mapUrl = property.latitude !== null && property.longitude !== null
    ? `https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationParts.join(", "))}`;
  const contactWhatsapp = property.whatsapp_number || property.phone_number;
  const priceBasis = property.price_basis;
  const allAmenities = [...new Set([...property.amenities, ...property.features])];
  const galleryMedia = property.media.some((item) => item.type === "image") || !property.cover_image_url ? property.media : [{ id: "cover-image", type: "image" as const, url: property.cover_image_url, thumbnail_url: property.cover_image_url, alt: `${property.name} accommodation`, caption: "" }, ...property.media];
  const propertySchema = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: property.name,
    description: property.description || undefined,
    url: `${getPublicEnv().siteUrl.replace(/\/$/, "")}/properties/${property.slug}`,
    ...(galleryMedia.some((item) => item.type === "image") ? { image: galleryMedia.filter((item) => item.type === "image").slice(0, 8).map((item) => item.url) } : {}),
    address: { "@type": "PostalAddress", streetAddress: property.address_line || undefined, addressLocality: property.city_name || undefined, addressRegion: property.state_name || undefined, addressCountry: "NG" },
    telephone: property.phone_number || undefined,
    amenityFeature: allAmenities.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    ...(property.latitude !== null && property.longitude !== null ? { geo: { "@type": "GeoCoordinates", latitude: property.latitude, longitude: property.longitude } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(propertySchema).replace(/</g, "\\u003c") }} />
      <Section spacing="sm"><Container><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search accommodation", href: "/search" }, ...(location ? [{ label: location, href: `/search?q=${encodeURIComponent(location)}` }] : []), { label: property.name }]} /></Container></Section>
      <Section spacing="md" className="pt-2"><Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)] lg:items-start">
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center gap-2"><span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-extrabold">{categoryLabel(property.category)}</span>{property.verification_status === "verified" ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800">{verificationLabel(property.verification_status)}</span> : <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-900">{verificationLabel(property.verification_status)}</span>}</div>
            <div className="flex flex-wrap items-start justify-between gap-3"><Heading as="h1" size="display">{property.name}</Heading><SharePropertyButton title={property.name} /></div>
            <div className="mt-4"><VisitorPropertyActions property={{ id: property.id, name: property.name, slug: property.slug, category: property.category, city: property.city_name, neighbourhood: property.neighbourhood_name, price: property.price_amount, priceBasis: property.price_basis, image: property.cover_image_url, bedrooms: property.bedrooms, bathrooms: property.bathrooms, guests: property.guest_capacity, latitude: property.latitude, longitude: property.longitude, amenities: property.amenities, features: property.features, landmarks: property.nearby_landmarks }} /></div>
            <p className="mt-3 text-sm text-muted-foreground">{locationParts.join(", ") || "Location details not provided"}</p>
            <div className="mt-6"><PropertyGallery media={galleryMedia} propertyName={property.name} /></div>
          </div>
          <aside className="grid gap-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Property price</p>
              <p className="mt-2 text-h2 font-extrabold text-primary">{formatPrice(property.price_amount, priceBasis)}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatDate(property.price_updated_at)}</p>
              <p className="mt-4 rounded-lg bg-surface-muted p-3 text-sm leading-6">{SITE.priceDisclaimer}</p>
              <div className="mt-5 grid gap-2">
                {contactWhatsapp ? <a href={whatsappHref(contactWhatsapp, property.name)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#16734c] px-4 text-sm font-extrabold text-white hover:bg-[#125d3e]">WhatsApp property</a> : null}
                {property.phone_number ? <a href={phoneHref(property.phone_number)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-input-border px-4 text-sm font-bold hover:bg-surface-muted">Call property</a> : null}
                {property.contact_email ? <a href={`mailto:${encodeURIComponent(property.contact_email)}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-input-border px-4 text-sm font-bold hover:bg-surface-muted">Email property</a> : null}
                <a href="#contact-property" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-input-border px-4 text-sm font-bold hover:bg-surface-muted">Send an enquiry</a>
              </div>
              {!contactWhatsapp && !property.phone_number && !property.contact_email ? <p className="mt-3 text-xs text-muted-foreground">Direct contact details have not been published. You can still send an enquiry below.</p> : null}
              {property.website_url ? <a href={property.website_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-bold text-accent-text underline underline-offset-4">Visit property website</a> : null}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-extrabold">At a glance</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">{[["Bedrooms", property.bedrooms], ["Bathrooms", property.bathrooms], ["Guest capacity", property.guest_capacity]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-surface-muted p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-extrabold">{value === null ? "Not stated" : label === "Guest capacity" ? `${value} guests` : value}</dd></div>)}</dl>
            </div>
          </aside>
        </div>
      </Container></Section>

      <Section spacing="lg" tone="muted"><Container><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)]">
        <div className="grid content-start gap-8">
          <section><Heading as="h2" size="h2">About this property</Heading><Text className="mt-3 whitespace-pre-line">{property.description || "A detailed property description has not yet been provided."}</Text></section>
          <section id="reviews"><div className="flex flex-wrap items-end justify-between gap-3"><div><Heading as="h2" size="h2">Visitor reviews</Heading><p className="mt-2 text-sm text-muted-foreground">{reviewStats ? `${reviewStats.average_rating}/5 from ${reviewStats.review_count} published review(s) · ${reviewStats.verified_review_count} evidence-verified` : "No published reviews yet. Ratings are never invented."}</p></div></div><div className="mt-4 grid gap-3">{(publicReviews ?? []).map((review) => <article key={review.id} className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{review.reviewer_display_name}</p><span className="text-sm font-extrabold">{review.rating}/5</span></div>{review.title ? <h3 className="mt-2 font-bold">{review.title}</h3> : null}<p className="mt-2 whitespace-pre-line text-sm">{review.body}</p><p className="mt-2 text-xs text-muted-foreground">{review.evidence_level === "verified" ? "Evidence verified by Hotelnearby" : review.evidence_level === "evidence_supplied" ? "Evidence supplied · not independently verified" : "Unverified visitor review"} · {new Date(review.created_at).toLocaleDateString("en-NG")}</p>{review.provider_response ? <div className="mt-3 rounded-lg bg-surface-muted p-3"><p className="text-xs font-extrabold">Property response</p><p className="mt-1 text-sm">{review.provider_response}</p></div> : null}<form action={submitListingReportAction} className="mt-3 border-t border-border pt-3"><input type="hidden" name="reviewId" value={review.id}/><label className="grid gap-1 text-xs font-semibold">Report this review<select name="reason" className="min-h-9 rounded border border-input-border bg-background px-2"><option value="review_integrity">Review integrity concern</option><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="other">Other</option></select></label><textarea name="details" required minLength={20} maxLength={2000} placeholder="Explain the concern (at least 20 characters)" className="mt-2 w-full rounded border border-input-border bg-background p-2 text-sm"/><button className="mt-2 text-xs font-bold text-accent-text underline">Submit review report</button></form></article>)}</div><div className="mt-5 rounded-xl border border-border bg-surface p-4"><h3 className="font-extrabold">Share your experience</h3><p className="mt-1 text-xs text-muted-foreground">Hotelnearby does not process accommodation bookings. Reviews are not automatically treated as confirmed stays. Evidence is checked separately by a moderator.</p><form action={submitReviewAction} className="mt-4 grid gap-3"><input type="hidden" name="propertyId" value={property.id}/><label className="grid gap-1 text-sm font-semibold">Display name<input name="displayName" required minLength={2} maxLength={60} className="min-h-10 rounded border border-input-border bg-background px-3"/></label><label className="grid gap-1 text-sm font-semibold">Rating<select name="rating" className="min-h-10 rounded border border-input-border bg-background px-3">{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Review title<input name="title" maxLength={120} className="min-h-10 rounded border border-input-border bg-background px-3"/></label><label className="grid gap-1 text-sm font-semibold">Your review<textarea name="body" required minLength={20} maxLength={3000} rows={4} className="rounded border border-input-border bg-background p-3"/></label><label className="grid gap-1 text-sm font-semibold">Month of visit (optional, self-reported)<input type="month" name="stayMonth" className="min-h-10 rounded border border-input-border bg-background px-3"/></label><button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Submit for moderation</button><p className="text-xs text-muted-foreground">Requires a signed-in account with verified email. Your review remains unpublished until moderated.</p></form></div></section>
          <section className="rounded-xl border border-border bg-surface p-4"><h2 className="font-extrabold">Report this listing</h2><p className="mt-1 text-xs text-muted-foreground">Report inaccurate details, misleading photos, suspected fraud or safety concerns. Reports are reviewed by Hotelnearby; submission does not automatically remove a listing.</p><form action={submitListingReportAction} className="mt-3 grid gap-2"><input type="hidden" name="propertyId" value={property.id}/><select name="reason" className="min-h-10 rounded border border-input-border bg-background px-3 text-sm">{[["inaccurate_information","Inaccurate information"],["misleading_photos","Misleading photos"],["suspected_fraud","Suspected fraud"],["impersonation","Impersonation"],["safety_concern","Safety concern"],["spam","Spam"],["other","Other"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><textarea name="details" required minLength={20} maxLength={2000} placeholder="Describe the issue (at least 20 characters)" className="rounded border border-input-border bg-background p-3 text-sm"/><button className="justify-self-start text-sm font-bold text-accent-text underline">Send report</button></form></section>
                    <section><Heading as="h2" size="h2">Amenities and features</Heading>{allAmenities.length ? <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{allAmenities.map((item) => <li key={item} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm"><span className="text-accent-text" aria-hidden="true">✓</span>{item.replaceAll("-", " ")}</li>)}</ul> : <Text tone="muted" className="mt-3">Amenities have not been listed yet.</Text>}</section>
          {property.room_categories.length ? <section><Heading as="h2" size="h2">Room categories</Heading><Text tone="muted" className="mt-2">These are room types offered by the property, not individually identified apartment units.</Text><div className="mt-4 grid gap-3">{property.room_categories.map((item) => <OfferingCard key={item.id} offering={item} title="Room category" />)}</div></section> : null}
          {property.apartment_units.length ? <section><Heading as="h2" size="h2">Available apartment units</Heading><Text tone="muted" className="mt-2">Each entry represents a separately managed apartment unit.</Text><div className="mt-4 grid gap-3">{property.apartment_units.map((item) => <OfferingCard key={item.id} offering={item} title="Apartment unit" />)}</div></section> : null}
          {property.nearby_landmarks.length ? <section><Heading as="h2" size="h2">Nearby landmarks</Heading><ul className="mt-3 grid gap-2">{property.nearby_landmarks.map((item) => <li key={`${item.name}-${item.distance}`} className="flex justify-between gap-4 rounded-lg border border-border bg-surface p-3 text-sm"><span className="font-semibold">{item.name}</span>{item.distance ? <span className="text-muted-foreground">{item.distance}</span> : null}</li>)}</ul></section> : null}
        </div>
        <aside className="grid content-start gap-5">
          <section className="rounded-2xl border border-border bg-surface p-5"><Heading as="h2" size="h3">Location and map</Heading><p className="mt-2 text-sm text-muted-foreground">{locationParts.length > 1 ? locationParts.slice(0, -1).join(", ") : "The property has not supplied a full address."}</p>
            {property.latitude !== null && property.longitude !== null || locationParts.length > 1 ? <><iframe title={`Map showing ${property.name}`} src={`https://www.google.com/maps?q=${property.latitude !== null && property.longitude !== null ? `${property.latitude},${property.longitude}` : encodeURIComponent(locationParts.slice(0, -1).join(", "))}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="mt-4 h-52 w-full rounded-lg border-0" /><a href={mapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-input-border px-4 text-sm font-bold hover:bg-surface-muted">Open location in Google Maps ↗</a></> : <p className="mt-3 text-sm text-muted-foreground">Map coordinates and address have not been provided for this listing.</p>}</section>
          <section className="rounded-2xl border border-border bg-surface p-5"><Heading as="h2" size="h3">Check-in and check-out</Heading><div className="mt-3 grid gap-3 text-sm"><div><p className="font-bold">Check-in</p><p className="mt-1 text-muted-foreground">{property.check_in_information || "Contact the property to confirm check-in arrangements."}</p></div><div><p className="font-bold">Check-out</p><p className="mt-1 text-muted-foreground">{property.check_out_information || "Contact the property to confirm check-out arrangements."}</p></div></div></section>
          <section className="rounded-2xl border border-border bg-surface p-5"><Heading as="h2" size="h3">House rules</Heading><p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{property.house_rules || "House rules have not been supplied. Contact the property before your visit."}</p></section>
        </aside>
      </div></Container></Section>

      <Section spacing="lg"><Container><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]"><PropertyContactForms slug={property.slug} />
        <div className="grid content-start gap-6">{property.similar_properties.length ? <section><Heading as="h2" size="h2">Similar properties</Heading><div className="mt-4 grid gap-3">{property.similar_properties.map((similar) => <Link key={similar.id} href={`/properties/${similar.slug}`} className="flex gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-surface-muted">{similar.cover_image_url ? <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-surface-muted">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={similar.cover_image_url} alt="" className="size-full object-cover" loading="lazy" /></div> : <div className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-2xl">⌂</div>}<div className="min-w-0"><p className="font-bold">{similar.name}</p><p className="mt-1 text-xs text-muted-foreground">{categoryLabel(similar.category)} · {[similar.city_name, similar.state_name].filter(Boolean).join(", ")}</p><p className="mt-2 text-sm font-extrabold text-primary">{formatPrice(similar.price_amount, similar.price_basis)}</p></div></Link>)}</div></section> : null}
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Listing details are supplied by the property and may change. Confirm important information directly before making travel arrangements. Hotelnearby does not process reservations or guest payments on this page.</div>
          <Link href={`/search?q=${encodeURIComponent(location || property.category)}`} className="text-sm font-bold text-accent-text underline underline-offset-4">Browse more accommodation</Link>
        </div></div></Container></Section>
    </>
  );
}
