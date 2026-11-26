import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";

const enquirySchema = z.object({
  kind: z.literal("enquiry"),
  slug: z.string().min(1).max(180),
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().min(5).max(180),
  message: z.string().trim().min(10).max(3000),
});
const reportSchema = z.object({
  kind: z.literal("report"),
  slug: z.string().min(1).max(180),
  name: z.string().trim().min(2).max(120),
  reason: z.enum(["incorrect-information", "unavailable-property", "suspected-fraud", "inappropriate-content", "other"]),
  details: z.string().max(2000).optional().default(""),
  contact: z.string().max(180).optional().default(""),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const parsed = z.discriminatedUnion("kind", [enquirySchema, reportSchema]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Please check the required fields and try again." }, { status: 400 });

  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return NextResponse.json({ ok: false, message: "The contact service is not connected yet. Please use the phone, WhatsApp or email details shown on this listing." }, { status: 503 });
  }
  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = parsed.data.kind === "enquiry"
    ? await supabase.rpc("submit_public_property_contact", {
        p_slug: parsed.data.slug,
        p_sender_name: parsed.data.name,
        p_sender_contact: parsed.data.contact,
        p_message: parsed.data.message,
      })
    : await supabase.rpc("submit_public_property_report", {
        p_slug: parsed.data.slug,
        p_reporter_name: parsed.data.name,
        p_reason: parsed.data.reason,
        p_details: parsed.data.details,
        p_reporter_contact: parsed.data.contact || null,
      });

  if (result.error) return NextResponse.json({ ok: false, message: "We could not submit this right now. Please use the direct contact options or try again later." }, { status: 503 });
  if (result.data !== true) return NextResponse.json({ ok: false, message: "This listing is no longer available." }, { status: 404 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
