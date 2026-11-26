import { describe, expect, it } from "vitest";
import { canMarkReviewEvidenceVerified, canPublishReview, isSafeVerificationObjectPath, propertyVerificationFromRecord, reviewEvidenceLabel } from "@/features/trust/rules";

describe("trust and safety workflows", () => {
  it("labels reviews honestly without assuming a confirmed stay", () => {
    expect(reviewEvidenceLabel("unverified")).toContain("Unverified");
    expect(reviewEvidenceLabel("evidence_supplied")).toContain("not independently verified");
    expect(reviewEvidenceLabel("verified")).toContain("Evidence verified");
  });
  it("requires a reviewer and meaningful evidence note before verified status", () => {
    expect(canMarkReviewEvidenceVerified("Checked a dated receipt", "reviewer-id")).toBe(true);
    expect(canMarkReviewEvidenceVerified("Looks fine", "reviewer-id")).toBe(false);
    expect(canMarkReviewEvidenceVerified("Evidence checked and issuer confirmed", null)).toBe(false);
  });
  it("requires moderation actor and reason before publication", () => {
    expect(canPublishReview("published", "moderator", "Meets policy")).toBe(true);
    expect(canPublishReview("published", null, "Meets policy")).toBe(false);
    expect(canPublishReview("pending", "moderator", "Meets policy")).toBe(false);
  });
  it("maps verification record decisions to the distinct property verification state", () => {
    expect(propertyVerificationFromRecord("verified")).toBe("verified");
    expect(propertyVerificationFromRecord("rejected")).toBe("rejected");
    expect(propertyVerificationFromRecord("expired")).toBe("unverified");
    expect(propertyVerificationFromRecord("submitted")).toBe("pending");
  });
  it("accepts only private object paths under the submitted property folder", () => {
    const property = "123e4567-e89b-12d3-a456-426614174000";
    expect(isSafeVerificationObjectPath(property, `${property}/proof.pdf`)).toBe(true);
    expect(isSafeVerificationObjectPath(property, "another-property/proof.pdf")).toBe(false);
    expect(isSafeVerificationObjectPath(property, `${property}/../private.pdf`)).toBe(false);
  });
});
