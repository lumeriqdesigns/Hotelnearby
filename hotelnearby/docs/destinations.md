# Destination discovery and publication rules (Prompt 6)

## Geographic hierarchy

`country -> state -> city_town -> neighbourhood -> landmark`

Nigeria is seeded with all 36 states and the Federal Capital Territory. The launch-town seed contains Ilorin, Offa, Omu-Aran, Jebba, Lafiagi, Patigi, Kaiama, Osi, Igbaja and Share in Kwara State. Neighbourhoods and landmarks are intentionally not seeded until their names and facts are verified.

## Public destination routes

- `/destinations` — searchable launch towns and nationwide state directory.
- `/destinations/[town-slug]` — destination profile for the ten Kwara launch towns.
- `/destinations/state/[state-slug]` — state coverage page.

Upcoming destination pages carry `noindex,follow`, canonical metadata and breadcrumbs. An administrator-selected upcoming city can have a safe placeholder route, but draft editorial text is never exposed. The page content is an honest preparation notice, not a thin guide presented as complete. Only published destination profiles should be indexed after meeting the configured quality threshold.

## Publication gate

The initial database defaults are three approved properties, two verified and published local content items and a fact-checked editorial summary of at least 160 characters. These thresholds are administrator-configurable. A database trigger blocks publication until the destination meets all three conditions and an administrator records the review. Verified content items can represent attractions, local businesses, events, transport, guides and visitor information. Publication requires an administrator review, a non-empty source reference and a verified status. A database trigger maintains the reviewed-content count; it is not provider-editable. The values are launch defaults, not claims that any destination currently qualifies.

## Homepage curation and recommendations

Administrators can manually select and order destination cards. Trusted aggregate metrics support recommendations: approved listing count, listing growth, search demand, property views, engagement and contact activity. The initial recommendation view uses equal-weight percentile ranks across the six signals; it is advisory and transparent, not a ranking promise. Recommendations are never published automatically. Approved property counts are shown only from the metrics table; missing or zero counts are not replaced with estimates. A narrow public homepage-card view exposes only selected card fields, never unpublished editorial content.

## Administrator access

`/admin/destinations` requires an authenticated user with the trusted Supabase `app_metadata.role = admin` claim. Row Level Security applies the same role claim. Do not set this claim from user-editable `user_metadata`. The page can manage homepage selection/order and editorial publication status, add neighbourhoods and landmarks, and create destination content items (attractions, local businesses, events, transport notes, guides and visitor information). Full editorial editing/version history belongs to the later CMS stage. Publishing a content item requires a source reference and an explicit verification confirmation; only verified, published items are public. Trusted server processes and database triggers maintain aggregate metrics; providers cannot edit them.

## Deployment sequence

1. Apply `supabase/migrations/202611240001_location_destination_discovery.sql` to the intended Supabase environment.
2. Confirm administrator role claims are issued only by trusted server-side administration.
3. Confirm the ten town nodes and 37 state/FCT nodes exist.
4. Connect the approved-listing, journal, attraction and analytics modules to maintain quality metrics.
5. Review destination content and test public/admin access under separate accounts before publication. If approved listing or reviewed-content totals later fall below the publication threshold, the database automatically unpublishes the destination.
