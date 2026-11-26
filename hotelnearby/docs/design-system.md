# Hotelnearby design system

Status: Updated with the Bento Grid + Glassmorphism system across public, authentication, provider and administrator workspaces. Live reference page: `/design-system` (development and staging only; returns 404 in production). Tokens: `src/styles/tokens.css`. Components: `src/components/ui`.

## Principles

Premium, welcoming hospitality discovery. Use calm light surfaces, midnight navy as the primary brand colour, champagne sparingly, large authentic photography, generous spacing and clear direct-contact actions. The interface must not imply guest reservations or booking payments.

## Approved palette

- Midnight Navy: `#172B46` — primary actions, navigation and brand panels.
- Warm Ivory: `#F5F2EB` — main page background.
- Champagne Gold: `#C9A66B` — restrained accent and highlights.
- Charcoal: `#252C35` — primary text.
- White: `#FFFFFF` — cards and form surfaces.
- Mist Blue: `#E9EDF2` — muted surfaces.

Use semantic tokens (`bg-surface`, `text-muted-foreground`, `border-input-border`, etc.) rather than hard-coded values. Raw palette utilities are for brand artwork and swatches.

Champagne is an accent/fill, not small text on light backgrounds. Use `accent-text` for readable accent text. Status colours always pair colour with an icon and words.

## Theme

Light theme only for the initial redesign, as approved in the blueprint. The root document explicitly declares `data-theme="light"` and `color-scheme: light`. Do not add a dark-mode toggle or dark-mode styles unless the product owner approves a later change.

## Typography

| Role | Font | Notes |
| --- | --- | --- |
| Interface and body | Manrope Variable | Primary typeface |
| Naira sign `₦` fallback | Plus Jakarta Sans Variable | Supplies the Naira glyph |
| Editorial accents | DM Serif Display | Decorative editorial headings only; never forms, prices, buttons or body text |

Headings use the fluid display scale; body text remains readable at 16px minimum, with captions no smaller than 13px.

## Components

Use the existing shared components in `src/components/ui`: Button, ButtonLink, fields, Card, Badge, Alert, Dialog, DropdownMenu, NavLink, Breadcrumbs, MobileNav, Container, Section, Heading, Text, EditorialAccent, Price, Spinner, Skeleton, LoadingState, EmptyState, StatePanel and ErrorState.

Server components are the default. Add client components only where interaction requires state. Use semantic tokens and preserve visible keyboard focus, labelled controls, reduced-motion support and 44px touch targets.

## Bento Grid + Glassmorphism application

The approved visual direction combines bento-style information grouping with selective glass surfaces. Bento layouts provide clear hierarchy for destination discovery, accommodation categories, provider metrics and administrator overview cards. The first card may receive greater visual weight on wide layouts; grids collapse to one or two columns on smaller screens.

Glassmorphism is reserved for the public navigation, homepage search panel, authentication form surfaces and selected dashboard navigation surfaces. It uses translucent white, a fine border and backdrop blur. Dense data tables, form controls and operational records remain solid enough to preserve legibility. Do not use blur as a substitute for contrast or accessible focus states.

The owner-selected warm hotel-bedroom photograph is stored at `public/images/homepage-hero.webp`. It is an atmospheric brand image, not a claim that the pictured property is located in Nigeria or listed on Hotelnearby. The homepage hero now uses this local asset with a navy contrast overlay.

The public shell applies the updated background and glass navigation across public routes. The shared `Card` component inherits the bento surface treatment. Provider and admin route layouts apply a consistent dashboard backdrop, with the admin navigation using a restrained frosted surface. Authentication pages use a soft brand-tinted backdrop and translucent form panel.

## Verification

`tests/unit/design-tokens.test.ts` checks the approved palette and WCAG AA contrast for the main semantic text/background pairs. The local verification attempt could not run lint/typecheck/tests because dependencies were not installed (`eslint` was unavailable); `npm ci` timed out in this environment. Run `npm ci`, `npm run check` and `npm run build` in the project environment before deployment.
