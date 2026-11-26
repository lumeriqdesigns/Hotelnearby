export const PLATFORM_PLANS = {
  starter: { monthly: 0, annual: 0 },
  professional: { monthly: 600_000, annual: 6_000_000 },
  premium: { monthly: 1_000_000, annual: 10_000_000 },
} as const;
export type PlanCode = keyof typeof PLATFORM_PLANS | "enterprise";
export type BillingInterval = "monthly" | "annual";
export function proratedUnusedCredit(currentAmount: number, periodStart: Date, periodEnd: Date, now: Date) {
  const total = periodEnd.getTime() - periodStart.getTime();
  if (total <= 0) return 0;
  const remaining = Math.max(0, Math.min(1, (periodEnd.getTime() - now.getTime()) / total));
  return Math.floor(currentAmount * remaining);
}
export function billingPeriodEnd(start: Date, interval: BillingInterval) {
  const end = new Date(start);
  if (interval === "monthly") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}

export function proratedPeriodValue(amount: number, periodStart: Date, periodEnd: Date, now: Date) {
  const total = periodEnd.getTime() - periodStart.getTime();
  if (total <= 0) return 0;
  const remaining = Math.max(0, Math.min(1, (periodEnd.getTime() - now.getTime()) / total));
  return Math.floor(amount * remaining);
}
