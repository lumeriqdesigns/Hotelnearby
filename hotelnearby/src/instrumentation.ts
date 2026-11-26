/**
 * Runs once when the server starts. Validates configuration so a bad
 * deployment fails immediately instead of at the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Do not require secrets just to compile the app in CI.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { getPublicEnv } = await import("@/lib/env/public");
  const { getServerEnv } = await import("@/lib/env/server");
  const { logger } = await import("@/lib/logger");

  const publicEnv = getPublicEnv();
  getServerEnv();

  if (publicEnv.appEnv === "development") {
    const missing: string[] = [];
    if (!publicEnv.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!publicEnv.supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (missing.length > 0) {
      logger.warn("Supabase is not configured yet. Pages that need data will not work.", {
        missing,
      });
    }
  }
}
