# Nearby discovery and events directories

## Public routes
- `/nearby` lists verified attractions and local services. Filter by city, directory type and category.
- `/nearby/[city]/[slug]` shows a moderated attraction or local service, its map pin and selected related accommodation.
- `/events` lists upcoming and ongoing verified events. Filter by city and event type.
- `/events/[city]/[slug]` shows event dates, venue, organiser contact, official website, external ticket link, venue map and selected accommodation.

## Administration
- `/admin/nearby-directory` creates and moderates attractions and local businesses/services.
- `/admin/events` creates and moderates events.
- Administrators can moderate directly. Editor/moderator accounts require `destinations.manage` for attractions/services and `events.manage` for events.
- New records enter `in_review` and `unverified`. Publishing requires an official source reference, human reviewer, publication timestamp and valid latitude/longitude. Attraction descriptions must contain at least 40 characters.
- Related accommodation must be approved, active and in the same city/town as the directory record. If no curated properties are attached, public detail pages fall back to approved active properties in that same city. Event date/time inputs are interpreted in `Africa/Lagos`.

## Categories
Local services: restaurant, cafe, shopping, event centre, park, gym, spa, hospital, university, airport, transport terminal and other.
Attractions: attraction, museum, heritage, nature, religious, entertainment, sport, gallery, cultural site, zoo, beach, waterfall, monument and other.
Events: concert, festival, conference, exhibition, sports, trade fair, cultural, community and other.

## Commercial boundary
Hotelnearby does not sell event tickets, process accommodation bookings or take accommodation payments through these directory pages. Ticket buttons link to an event organiser or its designated external ticket provider. Accommodation cards link to existing public property pages.

## Deployment and checks
Apply `202611250016_nearby_events_directories.sql` after migrations 001–015. The migration adds related-property tables, RLS policies, verified-coordinate publication guards and city-scoped detail routes that allow the same local slug in different cities. Run `supabase/tests/schema_invariants.sql` on a development database after all migrations. Run `npm run typecheck`, `npm test`, `npm run lint` and `npm run build`; then verify city/category filtering and related-property visibility with approved sample records in a development Supabase project. No real locations or events are seeded by this implementation.
