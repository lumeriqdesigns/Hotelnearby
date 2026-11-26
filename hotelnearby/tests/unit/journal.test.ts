import { describe, expect, it } from "vitest";
import { canonicalForArticle, isPublishReady, scheduledArticleIsDue } from "@/features/journal/rules";

const complete = { bodyMarkdown: "x".repeat(500), seoDescription: "Useful guide", featuredImageUrl: "https://cdn.example.com/guide.webp", featuredImageAlt: "A local market" };

describe("Travel Journal editorial rules", () => {
  it("requires substantive copy, SEO description and accessible featured image", () => {
    expect(isPublishReady(complete)).toBe(true);
    expect(isPublishReady({ ...complete, bodyMarkdown: "short" })).toBe(false);
    expect(isPublishReady({ ...complete, seoDescription: " " })).toBe(false);
    expect(isPublishReady({ ...complete, featuredImageAlt: "" })).toBe(false);
    expect(isPublishReady({ ...complete, featuredImageUrl: "http://example.com/image.jpg" })).toBe(false);
  });
  it("resolves internal, external and fallback canonicals", () => {
    expect(canonicalForArticle("https://hotelnearby.test/", "guide", "/journal/guide")).toBe("https://hotelnearby.test/journal/guide");
    expect(canonicalForArticle("https://hotelnearby.test", "guide", "https://publisher.test/guide")).toBe("https://publisher.test/guide");
    expect(canonicalForArticle("https://hotelnearby.test", "guide")).toBe("https://hotelnearby.test/journal/guide");
  });
  it("publishes scheduled articles only once their schedule is due", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    expect(scheduledArticleIsDue("2026-11-25T11:59:00Z", now)).toBe(true);
    expect(scheduledArticleIsDue("2026-11-25T12:01:00Z", now)).toBe(false);
    expect(scheduledArticleIsDue(null, now)).toBe(false);
    expect(scheduledArticleIsDue("not-a-date", now)).toBe(false);
  });
});
