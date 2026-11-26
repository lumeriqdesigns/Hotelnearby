# Accommodation search (Prompt 7)

## Data source and publication rules

Public search reads only from the `public.search_public_properties` RPC, which queries the `public.public_property_search` projection. The projection includes only records where `properties.approval_status = 'approved'` and `properties.is_active = true`. It does not treat enquiries, contact clicks or saved properties as reservations.

No property records are seeded by this migration. Search therefore returns an honest empty state until real properties have been created and approved.

## Database migration

Apply `supabase/migrations/202611240002_property_search.sql` after the Prompt 6 location/destination migration. It creates the initial `properties` search schema, indexes for common filters, a safe public projection, row-level security and the combined search RPC.

The `properties` table is a search-stage foundation. Prompt 10 (provider dashboard) and Prompt 13 (final database) must review and extend it for organisation ownership, listing workflow, room categories/apartment units, image storage, contacts, pricing history and audit records. Do not create a second competing properties table in those stages; evolve this one with migrations.

## Supported query parameters

- `q`: property name, description, category, state, city/town, neighbourhood or landmark
- `category`: accommodation category slug
- `minPrice`, `maxPrice`: numeric Naira bounds
- `bedrooms`, `bathrooms`, `guests`: minimum capacity/details
- `amenity`: repeatable amenity slug; all selected amenities must match
- `feature`: repeatable feature slug; any selected feature may match
- `verification`: `verified` or `unverified`
- `sort`: `relevance`, `lowest-price`, `highest-price`, `recently-updated`, `newest`
- `page`: one-based page number; 12 results per page

Filters use GET so the URL can be bookmarked, shared and revisited. Reset returns to `/search`.

## Security and launch notes

- Public access is read-only and limited to approved active property rows.
- Provider/admin write permissions are intentionally not added in this stage; they belong to the authenticated provider/admin stages.
- The RPC clamps page size to 48 maximum and applies database-side filtering and pagination.
- No booking dates, reservations, guest accommodation payments or booking commissions are part of search.
- Before launch, apply the migration to the intended Supabase environment and test with real approved test listings. Do not seed fictional public properties.
