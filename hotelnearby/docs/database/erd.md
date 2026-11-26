# Hotelnearby ERD (target schema after migrations 001-012)

Mermaid diagrams, split by domain so each stays readable. `auth.users` is Supabase Auth; `profiles` is the application "users" entity.
Dashed names are proposed in migrations 008-012 (not yet applied anywhere).

## 1. Identity and tenancy
```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "id"
  AUTH_USERS ||--o{ PROVIDER_ORGANISATIONS : "owner_user_id"
  PROVIDER_ORGANISATIONS ||--o{ PROVIDER_MEMBERSHIPS : has
  AUTH_USERS ||--o{ PROVIDER_MEMBERSHIPS : "user_id"
  PROVIDER_ORGANISATIONS ||--o{ PROVIDER_INVITATIONS : issues
  AUTH_USERS ||--o{ PLATFORM_PERMISSION_GRANTS : "user_id"
  AUTH_USERS ||--o{ ADMIN_AUDIT_LOGS : "actor_id (set null on erase)"
  PROVIDER_ORGANISATIONS ||--o{ PROPERTIES : markets
```

## 2. Listings and geography
```mermaid
erDiagram
  LOCATION_NODES ||--o{ LOCATION_NODES : parent_id
  LOCATION_NODES ||--o{ PROPERTIES : "location_id / city_location_id / state_location_id"
  ACCOMMODATION_CATEGORIES ||--o{ PROPERTIES : "category = slug"
  PROPERTIES ||--o{ PROPERTY_MEDIA : "images and video (property_images)"
  PROPERTIES ||--o{ PROPERTY_ROOM_CATEGORIES : "hotel room types"
  PROPERTIES ||--o{ PROPERTY_APARTMENT_UNITS : "individual units"
  PROPERTY_ROOM_CATEGORIES ||--o{ ROOM_IMAGES : ""
  PROPERTY_APARTMENT_UNITS ||--o{ ROOM_IMAGES : ""
  PROPERTIES ||--o{ PROPERTY_AMENITIES : ""
  AMENITIES ||--o{ PROPERTY_AMENITIES : ""
  AMENITIES ||--o{ ROOM_AMENITIES : ""
  PROPERTY_ROOM_CATEGORIES ||--o{ ROOM_AMENITIES : ""
  PROPERTY_APARTMENT_UNITS ||--o{ ROOM_AMENITIES : ""
  PROPERTIES ||--o{ PROPERTY_CONTACTS : ""
  PROPERTIES ||--o{ PROPERTY_NEARBY_LANDMARKS : ""
  LOCATION_NODES ||--o{ PROPERTY_NEARBY_LANDMARKS : "landmark_location_id"
  PROPERTIES ||--o{ PRICE_HISTORY : ""
  PROPERTIES ||--o{ PROPERTY_ENQUIRIES : ""
  PROPERTIES ||--o{ PROPERTY_LISTING_REPORTS : ""
  PROPERTIES ||--o{ VERIFICATION_RECORDS : ""
  PROPERTIES ||--o{ REVIEWS : ""
```

## 3. Destinations, directories and journal
```mermaid
erDiagram
  LOCATION_NODES ||--o| DESTINATION_PROFILES : "city/town only"
  LOCATION_NODES ||--o| DESTINATION_QUALITY_METRICS : ""
  LOCATION_NODES ||--o{ DESTINATION_CONTENT_ITEMS : ""
  LOCATION_NODES ||--o{ ATTRACTIONS : ""
  LOCATION_NODES ||--o{ LOCAL_BUSINESSES : ""
  LOCATION_NODES ||--o{ EVENTS : ""
  BLOG_CATEGORIES ||--o{ BLOG_ARTICLES : ""
  BLOG_ARTICLES ||--o{ BLOG_ARTICLE_PROPERTIES : ""
  PROPERTIES ||--o{ BLOG_ARTICLE_PROPERTIES : ""
  LOCATION_NODES ||--o{ BLOG_ARTICLES : "related_location_id"
```

## 4. Subscriptions, payments, promotions (Paystack: platform fees only)
```mermaid
erDiagram
  SUBSCRIPTION_PLANS ||--o{ PLAN_PRICES : ""
  SUBSCRIPTION_PLANS ||--o{ PLAN_FEATURES : ""
  SUBSCRIPTION_PLANS ||--o{ SUBSCRIPTIONS : ""
  PROPERTIES ||--o{ SUBSCRIPTIONS : "one live per property"
  PROVIDER_ORGANISATIONS ||--o{ SUBSCRIPTIONS : ""
  SUBSCRIPTIONS ||--o{ SUBSCRIPTION_PAYMENTS : ""
  PROMOTIONS ||--o{ SUBSCRIPTION_PAYMENTS : "purpose = promotion"
  SUBSCRIPTION_PAYMENTS ||--o{ PAYMENT_EVENTS : "append-only"
  SUBSCRIPTION_PAYMENTS ||--o{ REFUNDS : ""
  SUBSCRIPTION_PAYMENTS ||--o{ INVOICES : ""
  INVOICES ||--o{ INVOICE_ITEMS : ""
  PROPERTIES ||--o{ PROMOTIONS : ""
  PROMOTIONAL_INVENTORY ||--o{ PROMOTIONS : "exclusive slot, no overlap"
  PROMOTION_PRICES }o--|| PROMOTIONS : "price snapshot"
  WEBHOOK_EVENTS }o--o{ SUBSCRIPTION_PAYMENTS : "matched by reference"
```

## 5. Visitor tools, operations, AI, analytics
```mermaid
erDiagram
  AUTH_USERS ||--o{ SAVED_PROPERTIES : ""
  AUTH_USERS ||--o{ RECENTLY_VIEWED : ""
  AUTH_USERS ||--o{ COMPARISONS : ""
  COMPARISONS ||--o{ COMPARISON_ITEMS : "max 3"
  AUTH_USERS ||--o{ NOTIFICATIONS : ""
  SUPPORT_TICKETS ||--o{ SUPPORT_TICKET_MESSAGES : ""
  PROVIDER_ORGANISATIONS ||--o{ AI_LISTING_SESSIONS : ""
  AI_LISTING_SESSIONS ||--o{ AI_LISTING_EVENTS : ""
  AI_LISTING_SESSIONS ||--o{ AI_LISTING_DRAFTS : ""
  PROVIDER_ORGANISATIONS ||--o{ AI_LISTING_USAGE : "daily quota"
  PROPERTIES ||--o{ ANALYTICS_EVENTS : ""
  PROMOTIONS ||--o{ ANALYTICS_EVENTS : ""
```

## Approved entity to physical table
| Approved entity | Physical table | Note |
|---|---|---|
| users | `auth.users` + `profiles` | rename not recommended |
| organisations / organisation_members | `provider_organisations` / `provider_memberships` | keep names |
| locations / landmarks | `location_nodes` (level = landmark) + `property_nearby_landmarks` | linked by `landmark_location_id` |
| property_images | `property_media` | also holds video |
| room_categories / apartment_units | `property_room_categories` / `property_apartment_units` | keep names |
| enquiries | `property_enquiries` | |
| destinations | `destination_profiles` (+ metrics, content items) | |
| audit_logs | `admin_audit_logs` | broadened to system actors |
| AI listing sessions/drafts | `ai_listing_sessions`, `ai_listing_events`, `ai_listing_usage`, **`ai_listing_drafts`** | drafts new |
| all others | same name as the approved entity | new in 009-012 |
