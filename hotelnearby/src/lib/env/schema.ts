import { z } from "zod";

/**
 * Pure environment schemas. This file has no side effects and reads no
 * `process.env`, so it is safe to import anywhere and easy to unit test.
 *
 * Rules:
 *  - Empty strings are treated as "not set".
 *  - Error messages name the variable only. Values are never echoed.
 *  - Services needed by later stages (payments, email, AI, monitoring) are
 *    optional in development and required in staging/production only when the
 *    stage that uses them is built. See docs/architecture.md.
 */

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.url().optional());

export const appEnvSchema = z.enum(["development", "staging", "production"]);
export type AppEnv = z.infer<typeof appEnvSchema>;

/** E.164-style phone number, digits only after an optional plus. */
const phoneSchema = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, "must be a phone number in international format, e.g. +234...")
    .optional(),
);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.preprocess(blankToUndefined, appEnvSchema.default("development")),
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  NEXT_PUBLIC_SUPPORT_WHATSAPP: phoneSchema,
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: optionalString,
});

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  PAYSTACK_MODE: z.preprocess(blankToUndefined, z.enum(["test", "live"]).default("test")),
  PAYSTACK_SECRET_KEY: optionalString,
  PAYSTACK_WEBHOOK_SECRET: optionalString,
  EMAIL_PROVIDER_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: optionalString,
  SENTRY_DSN: optionalUrl,
  CRON_SECRET: optionalString,
});

export type PublicEnv = {
  appEnv: AppEnv;
  siteUrl: string;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  supportWhatsapp: string | undefined;
  paystackPublicKey: string | undefined;
};

export type ServerEnv = {
  supabaseServiceRoleKey: string | undefined;
  paystackMode: "test" | "live";
  paystackSecretKey: string | undefined;
  paystackWebhookSecret: string | undefined;
  emailProviderApiKey: string | undefined;
  openaiApiKey: string | undefined;
  openaiModel: string | undefined;
  sentryDsn: string | undefined;
  cronSecret: string | undefined;
};

export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n- ${issues.join("\n- ")}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

const DEV_SITE_URL = "http://localhost:3000";

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

type RawEnv = Record<string, string | undefined>;

/** Validate the browser-safe variables. Throws EnvValidationError. */
export function parsePublicEnv(raw: RawEnv): PublicEnv {
  const parsed = publicEnvSchema.safeParse(raw);
  if (!parsed.success) throw new EnvValidationError(formatIssues(parsed.error));

  const env = parsed.data;
  const issues: string[] = [];
  const isDeployed = env.NEXT_PUBLIC_APP_ENV !== "development";

  if (isDeployed) {
    if (!env.NEXT_PUBLIC_SITE_URL)
      issues.push("NEXT_PUBLIC_SITE_URL: required outside development");
    if (!env.NEXT_PUBLIC_SUPABASE_URL)
      issues.push("NEXT_PUBLIC_SUPABASE_URL: required outside development");
    if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY: required outside development");
  }
  if (issues.length > 0) throw new EnvValidationError(issues);

  return {
    appEnv: env.NEXT_PUBLIC_APP_ENV,
    siteUrl: env.NEXT_PUBLIC_SITE_URL ?? DEV_SITE_URL,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supportWhatsapp: env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
    paystackPublicKey: env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  };
}

/** Validate the server-only variables. Throws EnvValidationError. */
export function parseServerEnv(raw: RawEnv, appEnv: AppEnv): ServerEnv {
  const parsed = serverEnvSchema.safeParse(raw);
  if (!parsed.success) throw new EnvValidationError(formatIssues(parsed.error));

  const env = parsed.data;
  const issues: string[] = [];

  if (appEnv !== "development" && !env.SUPABASE_SERVICE_ROLE_KEY) {
    issues.push("SUPABASE_SERVICE_ROLE_KEY: required outside development");
  }
  if (issues.length > 0) throw new EnvValidationError(issues);

  return {
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    paystackMode: env.PAYSTACK_MODE,
    paystackSecretKey: env.PAYSTACK_SECRET_KEY,
    paystackWebhookSecret: env.PAYSTACK_WEBHOOK_SECRET,
    emailProviderApiKey: env.EMAIL_PROVIDER_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL,
    sentryDsn: env.SENTRY_DSN,
    cronSecret: env.CRON_SECRET,
  };
}
