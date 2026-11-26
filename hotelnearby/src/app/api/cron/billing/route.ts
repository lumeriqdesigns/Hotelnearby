import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { chargeAuthorization, verifyTransaction } from "@/lib/paystack/client";
import { settlePayment } from "@/app/api/billing/verify/route";
import { isPublishReady } from "@/features/journal/rules";
export async function POST(request: Request) {
  const secret = getServerEnv().cronSecret;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createSupabaseAdminClient(); const now = new Date();
  const { data: due } = await admin.from("subscriptions").select("*").in("status", ["active", "grace"]).or(`and(status.eq.active,auto_renew.eq.true,cancel_at_period_end.eq.false,current_period_end.lte.${now.toISOString()}),and(status.eq.grace,auto_renew.eq.true,cancel_at_period_end.eq.false,next_retry_at.lte.${now.toISOString()})`).limit(100);
  let processed = 0;
  for (const sub of due ?? []) {
    const { data: paymentMethod } = await admin.from("subscription_payment_methods").select("authorization,billing_email,reusable").eq("subscription_id", sub.id).maybeSingle();
    const auth = paymentMethod?.authorization as { reusable?: boolean; authorization_code?: string } | null;
    const { data: settings } = await admin.from("platform_billing_settings").select("grace_period_days,payment_retry_days,tax_rate_basis_points,processing_fee_basis_points,processing_fee_fixed_kobo").eq("id", true).maybeSingle();
    const graceDays = Number(settings?.grace_period_days ?? 7); const retryDays = (settings?.payment_retry_days as number[] | null) ?? [1, 3];
    if (sub.cancel_at_period_end) continue;
    if (!sub.auto_renew || !paymentMethod?.reusable || !auth?.reusable || !auth.authorization_code || !paymentMethod.billing_email) {
      if (sub.current_period_end && new Date(sub.current_period_end) <= now && sub.status === "active") {
        await admin.from("subscriptions").update({ status: "grace", auto_renew: false, grace_ends_at: new Date(new Date(sub.current_period_end).getTime() + graceDays * 86400000).toISOString() }).eq("id", sub.id);
      }
      continue;
    }
    if (sub.status === "active" && new Date(sub.current_period_end) > now) continue;
    let effectivePlanId = sub.plan_id as string; let effectivePriceId = sub.plan_price_id as string | null;
    if (sub.scheduled_plan_id && sub.scheduled_change_at && new Date(sub.scheduled_change_at) <= now) {
      const { data: scheduledPrice } = await admin.from("plan_prices").select("id").eq("plan_id", sub.scheduled_plan_id).eq("billing_interval", sub.billing_interval).eq("is_active", true).maybeSingle();
      effectivePlanId = sub.scheduled_plan_id; effectivePriceId = scheduledPrice?.id ?? null;
      await admin.from("subscriptions").update({ plan_id: effectivePlanId, plan_price_id: effectivePriceId, scheduled_plan_id: null, scheduled_change_at: null }).eq("id", sub.id);
    }
    const { data: price } = await admin.from("plan_prices").select("amount_kobo").eq("id", effectivePriceId ?? "").single();
    if (!price || Number(price.amount_kobo) <= 0) continue;
    const attempt = Number(sub.renewal_failure_count ?? 0); if (attempt > retryDays.length) continue;
    const amount = Number(price.amount_kobo); const fee = Math.floor(amount * Number(settings?.processing_fee_basis_points ?? 0) / 10000) + Number(settings?.processing_fee_fixed_kobo ?? 0);
    const tax = settings?.tax_rate_basis_points == null ? 0 : Math.floor(amount * Number(settings.tax_rate_basis_points) / 10000);
    const reference = `HNRENEW-${sub.id.replaceAll("-", "")}-${randomUUID().slice(0, 8)}`;
    const { data: payment, error } = await admin.from("subscription_payments").insert({ organisation_id: sub.organisation_id, purpose: "renewal", subscription_id: sub.id, reference, idempotency_key: reference, amount_kobo: amount, processing_fee_kobo: fee, tax_kobo: tax, status: "initiated", billing_metadata: { interval: sub.billing_interval, plan_id: effectivePlanId, plan_price_id: effectivePriceId, period_start: sub.current_period_end } }).select("*").single();
    if (error || !payment) continue;
    let chargeStarted = false;
    try {
      chargeStarted = true;
      await chargeAuthorization({ authorization_code: auth.authorization_code, email: paymentMethod.billing_email, amount: Number(payment.total_charged_kobo), reference, currency: "NGN", metadata: { payment_id: payment.id, subscription_id: sub.id, purpose: "renewal" } });
      const verified = await verifyTransaction(reference);
      if (verified.status !== "success" || Number(verified.amount) !== Number(payment.total_charged_kobo)) throw new Error("Renewal charge is not yet successful.");
      await settlePayment(admin, payment, verified);
      // A successful renewal advances the paid period and resets retry state.
      const end = new Date(sub.current_period_end); if (sub.billing_interval === "annual") end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
      await admin.from("subscriptions").update({ current_period_start: sub.current_period_end, current_period_end: end.toISOString(), renewal_failure_count: 0, next_retry_at: null, status: "active", grace_ends_at: null }).eq("id", sub.id);
    } catch (error) {
      if (chargeStarted) {
        let latest: Awaited<ReturnType<typeof verifyTransaction>> | null = null;
        try { latest = await verifyTransaction(reference); } catch { /* Unknown outcome: never issue a second charge blindly. */ }
        if (latest?.status === "failed" || latest?.status === "abandoned") chargeStarted = false;
        else if (latest?.status === "success" && Number(latest.amount) === Number(payment.total_charged_kobo)) {
          await settlePayment(admin, payment, latest);
          const end = new Date(sub.current_period_end); if (sub.billing_interval === "annual") end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
          await admin.from("subscriptions").update({ current_period_start: sub.current_period_end, current_period_end: end.toISOString(), renewal_failure_count: 0, next_retry_at: null, status: "active", grace_ends_at: null }).eq("id", sub.id);
          continue;
        } else {
          await admin.from("subscription_payments").update({ status: "pending", failure_reason: "Charge submitted; awaiting Paystack verification or webhook confirmation." }).eq("id", payment.id);
          await admin.from("subscriptions").update({ status: "grace", next_retry_at: null, last_renewal_attempt_at: now.toISOString() }).eq("id", sub.id);
          continue;
        }
      }
      const nextAttempt = attempt + 1; const retryDelay = retryDays[nextAttempt - 1]; const retryAt = retryDelay == null ? null : new Date(new Date(sub.current_period_end).getTime() + retryDelay * 86400000).toISOString();
      const expired = now.getTime() > new Date(sub.current_period_end).getTime() + graceDays * 86400000;
      await admin.from("subscriptions").update({ status: expired ? "expired" : "grace", renewal_failure_count: nextAttempt, last_renewal_attempt_at: now.toISOString(), next_retry_at: retryAt, grace_ends_at: new Date(new Date(sub.current_period_end).getTime() + graceDays * 86400000).toISOString() }).eq("id", sub.id);
      await admin.from("subscription_payments").update({ status: "failed", failure_reason: error instanceof Error ? error.message.slice(0, 450) : "Renewal failed" }).eq("id", payment.id);
    }
    processed++;
  }
  const { data: manualDue } = await admin.from("subscriptions").select("id,current_period_end").eq("status", "active").eq("auto_renew", false).eq("cancel_at_period_end", false).not("current_period_end", "is", null).lte("current_period_end", now.toISOString());
  for (const sub of manualDue ?? []) {
    const { data: settings } = await admin.from("platform_billing_settings").select("grace_period_days").eq("id", true).maybeSingle();
    const graceEnd = new Date(new Date(sub.current_period_end).getTime() + Number(settings?.grace_period_days ?? 7) * 86400000).toISOString();
    await admin.from("subscriptions").update({ status: "grace", grace_ends_at: graceEnd }).eq("id", sub.id);
  }
  const { data: expiredGrace } = await admin.from("subscriptions").select("id").eq("status", "grace").lte("grace_ends_at", now.toISOString());
  if (expiredGrace?.length) await admin.from("subscriptions").update({ status: "expired", auto_renew: false, next_retry_at: null }).in("id", expiredGrace.map((row) => row.id));
  const { data: cancelled } = await admin.from("subscriptions").select("id").eq("cancel_at_period_end", true).lte("current_period_end", now.toISOString()).in("status", ["active", "grace"]);
  if (cancelled?.length) await admin.from("subscriptions").update({ status: "cancelled", auto_renew: false }).in("id", cancelled.map((row) => row.id));
  // Apply scheduled downgrades at period end without deleting property content.
  const { data: downgrades } = await admin.from("subscriptions").select("id,scheduled_plan_id,scheduled_change_at,billing_interval").not("scheduled_plan_id", "is", null).lte("scheduled_change_at", now.toISOString()).eq("status", "active");
  for (const sub of downgrades ?? []) {
    const { data: targetPlan } = await admin.from("subscription_plans").select("code").eq("id", sub.scheduled_plan_id).single();
    if (targetPlan?.code !== "starter") continue;
    const { data: price } = await admin.from("plan_prices").select("id").eq("plan_id", sub.scheduled_plan_id).eq("billing_interval", sub.billing_interval).eq("is_active", true).maybeSingle();
    await admin.from("subscriptions").update({ plan_id: sub.scheduled_plan_id, plan_price_id: price?.id ?? null, scheduled_plan_id: null, scheduled_change_at: null, status: "active", current_period_start: now.toISOString(), current_period_end: null, billing_interval: null, auto_renew: false, cancel_at_period_end: false }).eq("id", sub.id);
  }
  // Travel Journal lifecycle: only editorially complete, scheduled articles publish at their due time.
  const { data: dueArticles } = await admin.from("blog_articles").select("id").eq("status", "scheduled").lte("scheduled_for", now.toISOString());
  let publishedArticles = 0;
  for (const article of dueArticles ?? []) {
    const { data: candidate } = await admin.from("blog_articles").select("id,body_markdown,seo_description,featured_image_url,featured_image_alt").eq("id", article.id).single();
    if (!candidate || !isPublishReady({ bodyMarkdown: candidate.body_markdown, seoDescription: candidate.seo_description, featuredImageUrl: candidate.featured_image_url, featuredImageAlt: candidate.featured_image_alt })) continue;
    const { data: updated } = await admin.from("blog_articles").update({ status: "published", published_at: now.toISOString() }).eq("id", article.id).eq("status", "scheduled").select("id").maybeSingle();
    if (updated) publishedArticles++;
  }
  // Promotion lifecycle: only paid and administrator-approved placements can run.
  const { data: activated } = await admin.from("promotions").update({ status: "active" }).eq("status", "scheduled").lte("starts_at", now.toISOString()).gt("ends_at", now.toISOString()).select("id");
  const { data: expiredPromotions } = await admin.from("promotions").update({ status: "expired" }).in("status", ["active", "scheduled"]).lte("ends_at", now.toISOString()).select("id");
  // Abandoned checkout holds do not reserve inventory and are released after 30 minutes.
  const staleBefore = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const { data: stale } = await admin.from("promotions").select("id").eq("status", "awaiting_payment").lt("created_at", staleBefore);
  if (stale?.length) {
    await admin.from("promotions").update({ status: "cancelled" }).in("id", stale.map((row) => row.id));
    await admin.from("subscription_payments").update({ status: "failed", failure_reason: "Checkout was not completed within 30 minutes." }).in("promotion_id", stale.map((row) => row.id)).in("status", ["initiated", "pending"]);
  }
  return NextResponse.json({ processed, expiredGrace: expiredGrace?.length ?? 0, manualRenewalsInGrace: manualDue?.length ?? 0, expiredCancellations: cancelled?.length ?? 0, appliedDowngrades: downgrades?.length ?? 0, activatedPromotions: activated?.length ?? 0, expiredPromotions: expiredPromotions?.length ?? 0, abandonedPromotionCheckouts: stale?.length ?? 0, publishedArticles });
}

export const GET = POST;
