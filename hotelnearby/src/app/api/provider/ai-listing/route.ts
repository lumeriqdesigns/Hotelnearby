import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePlatformRoles } from "@/features/auth/authorization";
import { listingCategories } from "@/features/ai-listing/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  organisationId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  answers: z.record(z.string(), z.string().max(1200)).default({}),
  providerNotes: z.string().max(4000).default(""),
});

const suggestionSchema = z.object({
  suggestedCategory: z.enum(listingCategories).nullable().catch(null),
  categoryReason: z.string().max(500).catch(""),
  descriptionDraft: z.string().max(1800).catch(""),
  locationQuestions: z.array(z.string().max(300)).max(6).catch([]),
  roomOrUnitGuidance: z.array(z.string().max(300)).max(8).catch([]),
  pricingBasisExplanation: z.string().max(500).catch(""),
  suggestedAmenities: z.array(z.string().max(80)).max(20).catch([]),
  photoGuidance: z.array(z.string().max(300)).max(8).catch([]),
  houseRulesDraft: z.string().max(1200).catch(""),
  missingFacts: z.array(z.string().max(200)).max(15).catch([]),
  nextQuestion: z.string().max(400).catch(""),
  nextQuestionOptions: z.array(z.string().max(160)).max(8).catch([]),
  completenessChecklist: z.array(z.object({ label: z.string().max(100), status: z.enum(["provided","missing","confirm"]) })).max(15).catch([]),
});

const systemPrompt = `You are the Hotelnearby AI Listing Guide. You help accommodation providers prepare accurate directory listings. This is NOT a consumer booking agent.

Use only facts explicitly supplied in the provider's answers. Never infer, embellish, estimate, or invent an address, ownership, exact location, price or currency, facilities, amenities, room count, apartment-unit count, guest capacity, bedroom/bathroom count, verification, licences, safety claims, accessibility, awards, ratings, distance, or other factual claim. Never state that a property is verified or licensed. Never invent a location identifier. If a fact is missing, ask for it or list it under missingFacts.

You may suggest a category based on the provider's explicit description, but label it as a suggestion and explain uncertainty. You may draft a neutral description using only supplied facts. Do not add marketing superlatives or unsupported claims. Amenity suggestions are ideas only and MUST be clearly marked for provider confirmation. Never treat suggestions as installed facilities. Keep room categories (hotel room types) conceptually separate from individually managed apartment units. Explain pricing bases; do not create or estimate prices. Do not suggest bookings, reservations, availability calendars, or guest payments.

Ask one useful next question at a time. Return only valid JSON matching the requested keys. Do not include markdown fences.`;

export async function POST(request: Request) {
  const auth = await requirePlatformRoles(["provider_owner", "provider_staff"]);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your answers and try again." }, { status: 400 });
  const { organisationId, answers, providerNotes, sessionId } = parsed.data;
  const { data: membership, error: membershipError } = await auth.supabase
    .from("provider_memberships").select("organisation_id").eq("organisation_id", organisationId).eq("user_id", auth.user.id).maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "You do not have access to this organisation." }, { status: 403 });

  let session: { id: string; turn_count: number; answers: Record<string, string> } | null = null;
  if (sessionId) {
    const { data } = await auth.supabase.from("ai_listing_sessions").select("id,turn_count,answers,organisation_id,created_by,status").eq("id", sessionId).maybeSingle();
    if (!data || data.organisation_id !== organisationId || data.created_by !== auth.user.id || data.status !== "in_progress") {
      return NextResponse.json({ error: "This guide session is unavailable." }, { status: 404 });
    }
    session = { id: data.id, turn_count: data.turn_count, answers: (data.answers ?? {}) as Record<string, string> };
    if (session.turn_count >= 12) return NextResponse.json({ error: "This guide has reached its 12-step limit. Review your draft or start a new guide." }, { status: 429 });
  }

  const mergedAnswers = { ...(session?.answers ?? {}), ...answers };
  const input = JSON.stringify({ providerAnswers: mergedAnswers, additionalNotes: providerNotes });
  if (input.length > 12000) return NextResponse.json({ error: "Please shorten your answers before continuing." }, { status: 413 });
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    return NextResponse.json({ error: "AI assistance is not configured yet. Add OPENAI_API_KEY and OPENAI_MODEL to the server environment. You can still create listings manually." }, { status: 503 });
  }
  const { data: quotaAllowed, error: quotaError } = await auth.supabase.rpc("consume_ai_listing_quota", { p_organisation_id: organisationId, p_input_characters: input.length });
  if (quotaError || !quotaAllowed) return NextResponse.json({ error: "Your organisation has reached its daily AI guide allowance of 20 generations. You can continue manually or try again tomorrow." }, { status: 429 });

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal: AbortSignal.timeout(22000),
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: `Prepare the next guided listing step using these provider-supplied answers. Output exactly the requested JSON object.\n${input}\nJSON keys: suggestedCategory, categoryReason, descriptionDraft, locationQuestions, roomOrUnitGuidance, pricingBasisExplanation, suggestedAmenities, photoGuidance, houseRulesDraft, missingFacts, nextQuestion, nextQuestionOptions, completenessChecklist.`,
        max_output_tokens: 1100,
        temperature: 0.2,
        text: { format: { type: "json_schema", name: "hotelnearby_listing_guide", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: {
            suggestedCategory: { anyOf: [{ type: "string", enum: listingCategories }, { type: "null" }] },
            categoryReason: { type: "string" },
            descriptionDraft: { type: "string" },
            locationQuestions: { type: "array", items: { type: "string" } },
            roomOrUnitGuidance: { type: "array", items: { type: "string" } },
            pricingBasisExplanation: { type: "string" },
            suggestedAmenities: { type: "array", items: { type: "string" } },
            photoGuidance: { type: "array", items: { type: "string" } },
            houseRulesDraft: { type: "string" },
            missingFacts: { type: "array", items: { type: "string" } },
            nextQuestion: { type: "string" },
            nextQuestionOptions: { type: "array", items: { type: "string" } },
            completenessChecklist: { type: "array", items: { type: "object", additionalProperties: false, properties: {
              label: { type: "string" }, status: { type: "string", enum: ["provided", "missing", "confirm"] }
            }, required: ["label", "status"] } }
          },
          required: ["suggestedCategory", "categoryReason", "descriptionDraft", "locationQuestions", "roomOrUnitGuidance", "pricingBasisExplanation", "suggestedAmenities", "photoGuidance", "houseRulesDraft", "missingFacts", "nextQuestion", "nextQuestionOptions", "completenessChecklist"]
        } } }
      }),
    });
  } catch {
    if (session?.id) await auth.supabase.from("ai_listing_events").insert({ session_id: session.id, organisation_id: organisationId, actor_id: auth.user.id, event_type: "generation_failed", fields: { reason: "upstream_timeout_or_network_error" }, model });
    return NextResponse.json({ error: "The AI service did not respond. Your answers are safe; please retry or continue manually." }, { status: 502 });
  }
  if (!response.ok) {
    if (session?.id) await auth.supabase.from("ai_listing_events").insert({ session_id: session.id, organisation_id: organisationId, actor_id: auth.user.id, event_type: "generation_failed", fields: { upstream_status: response.status }, model });
    return NextResponse.json({ error: "The AI service is temporarily unavailable. Please retry or continue manually." }, { status: 502 });
  }

  const payload = await response.json() as {
    output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
    status?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  if (payload.status === "incomplete") {
    return NextResponse.json({ error: "The AI response was incomplete. Please retry or continue manually." }, { status: 502 });
  }
  const outputContent = payload.output?.flatMap((item) => item.content ?? []) ?? [];
  if (outputContent.some((part) => part.type === "refusal")) {
    return NextResponse.json({ error: "The AI could not process this request. Please review your answers or continue manually." }, { status: 502 });
  }
  const text = outputContent.find((part) => part.type === "output_text")?.text ?? "";
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch { return NextResponse.json({ error: "The AI returned an unreadable response. Please retry." }, { status: 502 }); }
  const suggestions = suggestionSchema.safeParse(raw);
  if (!suggestions.success) return NextResponse.json({ error: "The AI response did not pass validation. Please retry." }, { status: 502 });

  let savedSessionId = session?.id;
  if (!savedSessionId) {
    const { data: created, error } = await auth.supabase.from("ai_listing_sessions").insert({ organisation_id: organisationId, created_by: auth.user.id, answers: mergedAnswers, suggestions: suggestions.data, turn_count: 1 }).select("id").single();
    if (error || !created) return NextResponse.json({ error: "Could not save this guide session. Please retry." }, { status: 500 });
    savedSessionId = created.id;
    await auth.supabase.from("ai_listing_events").insert({ session_id: savedSessionId, organisation_id: organisationId, actor_id: auth.user.id, event_type: "session_started", fields: { answer_keys: Object.keys(mergedAnswers) } });
  } else {
    const { error } = await auth.supabase.from("ai_listing_sessions").update({ answers: mergedAnswers, suggestions: suggestions.data, turn_count: session!.turn_count + 1 }).eq("id", savedSessionId);
    if (error) return NextResponse.json({ error: "Could not save the latest guide response." }, { status: 500 });
  }
  const inputTokens = payload.usage?.input_tokens ?? 0;
  const outputTokens = payload.usage?.output_tokens ?? 0;
  await Promise.all([
    auth.supabase.rpc("record_ai_listing_output", { p_organisation_id: organisationId, p_output_tokens: outputTokens }),
    auth.supabase.from("ai_listing_events").insert({ session_id: savedSessionId, organisation_id: organisationId, actor_id: auth.user.id, event_type: "guidance_generated", fields: { answer_keys: Object.keys(mergedAnswers), suggestion_fields: Object.keys(suggestions.data) }, model, input_tokens: inputTokens, output_tokens: outputTokens }),
  ]);
  return NextResponse.json({ sessionId: savedSessionId, suggestions: suggestions.data, turnCount: (session?.turn_count ?? 0) + 1, remainingToday: "Up to 20 generations per organisation per UTC day" });
}
