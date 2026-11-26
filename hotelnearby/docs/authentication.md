# Authentication and authorisation (Prompt 9)

## Authentication flows

- Visitor and provider-owner registration use Supabase Auth email/password signup.
- The signup form requires terms acceptance, validates a 10-character minimum password and asks providers for an organisation name.
- A database trigger creates the profile and (for provider owners) the organisation and owner membership. Only `visitor` and `provider_owner` can be selected by public signup; user metadata is treated as untrusted input.
- Email verification and recovery return to `/auth/confirm`, where the one-time token hash is verified and a cookie-backed session is created.
- Password reset sends a generic response to reduce account enumeration. The recovery callback exchanges the code before `/account/reset-password` allows an update.
- Sign-out revokes the local session. The Next.js 16 proxy refreshes session cookies using `auth.getClaims()`.

## Roles

`visitor`, `provider_owner`, `provider_staff`, `administrator`, and `editor_moderator` are stored in `profiles.role`. Provider organisation membership is stored separately and scopes access to properties and their child records. Provider staff can only be added to an organisation by its owner using `add_provider_staff`, and only verified existing accounts are accepted by the RPC. Administrator/editor roles are granted by an existing administrator through `set_platform_role`.

The first administrator must be assigned manually in the Supabase SQL Editor after signup and email verification. This is an explicit bootstrap operation, not a hardcoded account.

## Server and database enforcement

- `requireAuthenticatedUser` validates the Supabase user server-side and loads their profile role.
- `requirePlatformRoles` protects provider and platform administration route groups.
- Server actions repeat authorization at the action boundary.
- RLS protects profiles, provider organisations, memberships, properties, property child records and moderator-only report access.
- Users receive column-level update grants only for profile fields; role and email verification fields cannot be changed by the account holder.
- Provider listing triggers prevent provider owners/staff from approving, rejecting, suspending or self-verifying their own listings.
- Service-role credentials are not used by the auth feature and must never be exposed to the browser.

## Optional MFA

The account security page supports Supabase TOTP factor enrollment, QR/secret display, challenge verification and factor removal. MFA remains optional and is not forced for every account. Production assurance policies should be decided before privileged workflows are opened to all staff.

## Required environment and Supabase setup

See the Prompt 9 section in the project README for Auth redirect URLs, email confirmation, SMTP, password policy, CAPTCHA/rate limits, environment variables and first-administrator bootstrap steps.

## Outstanding live tests

Without a configured Supabase project and real email delivery, the following cannot be verified from the local project: visitor/provider registration, duplicate account behaviour, email verification, sign-in, sign-out cookie invalidation, recovery email delivery, password update, profile RLS, role escalation rejection, provider organisation isolation, admin route protection and TOTP MFA enrollment.

## Email template setup

For the Supabase **Confirm signup** template, use:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

For the **Reset password** template, use:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

The app supports signing out of the current session or revoking all sessions from the account profile page.
