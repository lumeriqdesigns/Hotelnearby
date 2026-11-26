# Public property detail pages (Prompt 8)

The public route is `/properties/[slug]`. It reads only approved, active properties through `get_public_property_detail`; a missing, suspended, inactive or unapproved listing is not exposed as a public detail page.

## Data model additions

- `properties`: address, coordinates, phone, WhatsApp, email, website, house rules, check-in/out information and `price_updated_at`.
- `property_media`: HTTPS image and video records, ordered independently of the cover image. The existing cover image is used as a gallery fallback when no gallery images are present.
- `property_room_categories`: hotel-style room types; each row is a room category, not an individually tracked unit.
- `property_apartment_units`: individually managed apartment units, intentionally separate from hotel room categories.
- `property_nearby_landmarks`: curated nearby place labels and distance descriptions.
- `property_enquiries`: public enquiry submissions.
- `property_listing_reports`: reports for incorrect, unavailable, fraudulent or inappropriate listings.

Prices accept `night`, `day`, `week`, `month`, `stay` and `other`. Amounts use the same naira denomination as the existing property search table. The exact public price disclaimer is rendered beside the headline price and each room/unit price. A missing price-update timestamp is labelled as not provided rather than inventing a date.

## Public contact and safety

WhatsApp, phone, email and optional website links are shown only when a provider has supplied them. The enquiry and report form posts to `/api/property-contact`; the API validates fields and calls narrowly scoped database functions. The database functions accept submissions only for approved active listings and apply basic per-contact submission limits. No reservation, availability calendar, booking action or guest payment is implemented.

The page includes native device sharing with a copy-link fallback. The detail RPC is `SECURITY DEFINER` with a fixed `search_path`; it returns only approved active property records and their active public child records. Child tables have RLS enabled and direct access revoked from public roles. Enquiry and report rows are not publicly readable.

## Setup and verification still required

Apply `supabase/migrations/202611240003_property_detail_pages.sql` after the location and property-search migrations. Populate real approved property, media, room/unit and contact records through the future provider/admin workflows. Configure Supabase public environment variables to exercise live pages and form submissions. This repository stage does not yet include provider-side editing screens or an admin enquiry/report inbox.
