import { connection, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env/public";

/**
 * Deployment health check. Reports only whether things are configured, never
 * any values. It does not contact Supabase or any other service.
 */
export async function GET() {
  // Opt out of prerendering so the response reflects the running deployment.
  await connection();
  const env = getPublicEnv();
  return NextResponse.json(
    {
      status: "ok",
      environment: env.appEnv,
      configured: { supabase: Boolean(env.supabaseUrl && env.supabaseAnonKey) },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
