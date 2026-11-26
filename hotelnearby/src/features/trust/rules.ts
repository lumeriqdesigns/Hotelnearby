export type ReviewEvidenceLevel = "unverified" | "evidence_supplied" | "verified";
export type VerificationStatus = "submitted" | "in_review" | "verified" | "rejected" | "expired" | "revoked";
export function reviewEvidenceLabel(level: ReviewEvidenceLevel): string {
  if (level === "verified") return "Evidence verified by Hotelnearby";
  if (level === "evidence_supplied") return "Evidence supplied · not independently verified";
  return "Unverified visitor review";
}
export function canMarkReviewEvidenceVerified(note: string, reviewerId: string | null): boolean {
  return note.trim().length >= 10 && Boolean(reviewerId);
}
export function canPublishReview(status: string, moderatorId: string | null, reason: string): boolean {
  return status === "published" && Boolean(moderatorId) && reason.trim().length >= 5;
}
export function propertyVerificationFromRecord(status: VerificationStatus): "unverified" | "pending" | "verified" | "rejected" {
  if (status === "verified") return "verified";
  if (status === "rejected") return "rejected";
  if (status === "in_review") return "pending";
  if (status === "submitted" || status === "expired" || status === "revoked") return "unverified";
  return "unverified";
}
export function isSafeVerificationObjectPath(propertyId: string, path: string): boolean {
  return path.startsWith(`${propertyId}/`) && /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{3,180}$/i.test(path);
}
