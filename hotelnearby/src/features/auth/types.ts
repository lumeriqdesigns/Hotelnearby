export const PLATFORM_ROLES = [
  "visitor",
  "provider_owner",
  "provider_staff",
  "administrator",
  "editor_moderator",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export type AuthFormState = {
  ok: boolean;
  message: string;
};

export const EMPTY_AUTH_STATE: AuthFormState = { ok: false, message: "" };
