# AI Listing Guide (Prompt 11)

## Provider choice

Providers can create listings manually at `/dashboard/properties/new` or use the optional AI Listing Guide at `/dashboard/ai-listing`. Both paths create ordinary provider-owned drafts. The AI guide is not a consumer booking agent.

## Workflow and safeguards

1. A signed-in provider owner/staff member selects an organisation they belong to.
2. The guide collects structured provider answers about accommodation type, rooms/units, location details, pricing basis, confirmed facilities and visitor information.
3. A server-only OpenAI Responses API call may suggest a category, draft a neutral description, ask follow-up questions, explain pricing bases, suggest amenities for confirmation, provide photo guidance and identify missing facts.
4. Suggestions are schema-validated and saved to an organisation-scoped AI session. Nothing is written to a property until the provider explicitly reviews the draft form and submits it.
5. The create action independently verifies session ownership, organisation membership, location ID, category and provider-entered price. It creates a `draft` property with `unverified` status. It does not approve or submit the listing.
6. The provider continues editing in the existing dashboard and separately submits the property for administrator review.

The model is instructed not to invent addresses, ownership, prices, facilities, room/unit quantities, guest capacity, verification, licences, distances, ratings or other factual claims. Exact location must be selected from the existing location hierarchy. Amenities suggested by AI are unchecked until the provider confirms them. Hotel room types and individually managed apartment units remain separate concepts and are managed through the existing dashboard forms.

## Cost controls and audit

- Maximum 20 generations per organisation per UTC day, enforced by an atomic PostgreSQL quota function.
- Maximum 12 generations per guide session.
- Maximum 12,000 input characters per request and 1,100 model output tokens.
- 22-second upstream timeout.
- Model identifier is configured explicitly; no model is silently assumed.
- Generation events, selected suggestion fields, model identifier and token usage are stored in `ai_listing_events` / `ai_listing_usage`.
- AI credentials remain server-only. The browser never receives the OpenAI API key.

## Environment

Configure these server-side variables in local development and deployment environments:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (choose a model available to the account; no default is hardcoded)

If either is missing, the guide explains that AI is unavailable and manual listing remains available.

## Database setup

Apply `supabase/migrations/202611240006_ai_listing_guide.sql` after migrations `202611240001` through `202611240005`. The migration creates session, daily usage and audit-event tables with RLS, plus atomic quota functions. No sample sessions, usage or property data are seeded.

## Known limitations before production

- A real OpenAI API key and model must be configured to test generation end-to-end.
- Provider-entered address, price, category and location are confirmed manually; the guide does not geocode or validate legal ownership.
- The guide creates a property draft only. Room-category/apartment-unit records, photo uploads and final listing submission remain in the existing provider dashboard workflow.
- Email, subscription billing and consumer booking features are outside this feature.
