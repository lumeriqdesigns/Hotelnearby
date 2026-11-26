import "server-only";

import { getPublicEnv } from "./public";
import { parseServerEnv, type ServerEnv } from "./schema";

let cached: ServerEnv | undefined;

/** Validated server-only configuration. Importing this from client code fails the build. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      PAYSTACK_MODE: process.env.PAYSTACK_MODE,
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
      PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET,
      EMAIL_PROVIDER_API_KEY: process.env.EMAIL_PROVIDER_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      SENTRY_DSN: process.env.SENTRY_DSN,
      CRON_SECRET: process.env.CRON_SECRET,
    },
    getPublicEnv().appEnv,
  );
  return cached;
}
