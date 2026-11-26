export type PromotionType = "featured" | "homepage" | "city" | "category";
export function calculatePromotionEndAt(startsAt: Date, durationDays: number): Date {
  if (!Number.isFinite(startsAt.getTime()) || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90) throw new Error("Invalid promotional schedule.");
  return new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
}
export function getApprovedPromotionStatus(startsAt: Date, now = new Date()): "active" | "scheduled" {
  return startsAt.getTime() > now.getTime() ? "scheduled" : "active";
}
export function isValidPromotionTarget(type: PromotionType, locationId?: string | null, categorySlug?: string | null): boolean {
  if (type === "city") return Boolean(locationId) && !categorySlug;
  if (type === "category") return Boolean(categorySlug) && !locationId;
  return !locationId && !categorySlug;
}
