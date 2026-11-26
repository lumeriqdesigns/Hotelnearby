# Visitor travel tools

## Routes
- `/travel-tools`: full visitor planning workspace.
- `/my-travel`: saved and recent property workspace.
- `/properties/[slug]`: save to a named wishlist, compare, and record a recent view.

## Storage and privacy
Anonymous visitor state uses the browser key `hotelnearby.visitor.v1`. It contains property IDs and public listing details, wishlist names, up to three comparison records, the travel checklist and optional trip expense notes. The anonymous list and planning payload stays in the browser; unauthenticated sync attempts are not persisted. Signed-in saved properties, recent views and comparisons use the existing `saved_properties`, `recently_viewed`, `comparisons` and `comparison_items` tables with row-level security. Recent views are written through `touch_recently_viewed`, which accepts only approved active properties and retains the latest 30 per user.

The tools do not request precise device location, do not store payment or identity data, and do not make reservations. Expense estimates remain local to the browser. Users should avoid entering sensitive personal or financial details.

## Calculation rules
- Accommodation estimates use only a real property price whose basis is `night` or `day`; other price bases are not multiplied by nights.
- Group cost split is an equal arithmetic split; it does not determine room occupancy or property capacity.
- Distance uses the Haversine formula between entered origin coordinates and published property coordinates. It is straight-line distance, not route distance or travel time.
- Suitability checks report which selected features are explicitly listed on a property. Missing features are not evidence that the facility is absent.
- Neighbourhood notes show only published city, neighbourhood and nearby-landmark data. Visitors should independently confirm current local conditions and access.

## Verification
Unit tests cover price-basis handling, invalid nights, group splitting, coordinate validation, Haversine distance, feature matching and the three-property comparison limit. The full Next.js build and browser/device QA still need to be run with project dependencies and a connected Supabase development environment.
