# Promotional placement workflow — Prompt 15

## Commercial rules

- Featured: ₦3,000 / 7 days or ₦10,000 / 30 days.
- Homepage: ₦7,500 / 7 days or ₦25,000 / 30 days.
- City and category: from ₦5,000; an administrator must configure an explicit duration and amount because the playbook does not define a default duration.
- Prices are stored in integer kobo and read server-side. Processing fees are disclosed separately and charged to the provider; tax remains configurable.
- Promotions are paid Hotelnearby platform placements only. They are not guest accommodation bookings, reservation services, provider payouts or booking commissions.

## Lifecycle

1. An organisation owner selects an active, approved property, placement type, configured duration, matching city/category target and preferred start date.
2. The server validates the property, ownership, target, active price and NGN currency, then reserves a matching exclusive inventory slot for the requested dates before creating the Paystack payment. PostgreSQL's exclusion constraint arbitrates concurrent checkouts; if all matching slots are occupied, the provider is not charged.
3. A unique platform payment reference and `awaiting_payment` promotion record are created before redirecting to Paystack.
4. Paystack webhook or authenticated callback verification confirms the reference, NGN currency and exact expected amount. A verified payment moves the promotion to `pending_approval`; it does not publish the placement.
5. An administrator creates and maintains inventory slots, reviews paid requests, confirms the reserved slot (or selects another matching slot), and approves/rejects. Rejection automatically creates a full refund request for refund administration.
6. Approval confirms the exclusive slot and records approver/time. A start in the future becomes `scheduled`; a current start becomes `active`. End time is calculated from the purchased duration.
7. The billing cron changes due scheduled placements to active, expires placements after end time, and cancels abandoned unpaid checkouts. Public pages also filter by start/end timestamps, so an expired placement is not rendered while waiting for the cron.

## Exclusive inventory

The `promotions_no_overlap_per_slot` PostgreSQL exclusion constraint prevents two pending-payment, pending-approval, approved, scheduled or active placements from overlapping in the same `inventory_id`. The administrator API handles PostgreSQL exclusion violation `23P01` and asks for another slot/date. City and category slots are target-specific. Database trigger `guard_promotion_approval` verifies the slot target, verified payment, approver and dates, and confirms city/category placement matches the property's current city/category.

## Public display and reporting

`get_live_promotional_placements` exposes only limited fields for active, in-date, approved properties with an active inventory slot. Homepage and featured placements appear on the homepage; city placements appear on matching destination pages; category placements appear on matching category-filtered search pages. Every card is labelled **Sponsored**. The paid rail is separate from organic search results and does not alter organic ranking.

Impressions are recorded when the placement enters the viewport; clicks pass through a first-party redirect that records the click before opening the property. Provider billing and administrator promotion screens show observed impression/click counts and click-through rate. Counts are observational and do not promise views, enquiries, rankings or reservations.

## Required deployment steps

1. Review and apply migrations 001–013 to a separate development Supabase project first.
2. Review and apply `202611250014_promotional_placement_runtime.sql` after 001–013.
3. Confirm the Paystack test secret and webhook configuration from Prompt 14 remain in test mode.
4. Configure at least one inventory slot for each placement type/target before approving a paid request.
5. Configure explicit city/category durations/prices in Admin → Billing configuration (minimum ₦5,000).
6. Configure the existing `/api/cron/billing` schedule in Vercel. It also transitions scheduled promotions, expires placements and releases abandoned unpaid requests.
7. Run the application checks and SQL invariants against development. No live Paystack activation or production migration is authorised by this implementation.
