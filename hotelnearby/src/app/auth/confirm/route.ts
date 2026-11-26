import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES = ["signup", "recovery", "invite", "email"] as const;

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");
  if (!tokenHash || !requestedType || !OTP_TYPES.includes(requestedType as (typeof OTP_TYPES)[number])) {
    return NextResponse.redirect(new URL("/sign-in?error=verification", request.nextUrl.origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: requestedType as (typeof OTP_TYPES)[number],
    });
    if (!error) {
      const destination = requestedType === "recovery" ? "/account/reset-password" : "/account/profile";
      return NextResponse.redirect(new URL(destination, request.nextUrl.origin));
    }
  } catch {
    // Return a generic message; never expose token or Auth provider details.
  }
  const fallback = requestedType === "recovery" ? "/forgot-password?error=recovery" : "/sign-in?error=verification";
  return NextResponse.redirect(new URL(fallback, request.nextUrl.origin));
}
