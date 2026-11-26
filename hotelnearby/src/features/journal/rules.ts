export type EditorialCandidate = {
  bodyMarkdown: string;
  seoDescription: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
};

export function isPublishReady(article: EditorialCandidate): boolean {
  return article.bodyMarkdown.trim().length >= 500
    && Boolean(article.seoDescription?.trim())
    && Boolean(article.featuredImageUrl?.startsWith("https://"))
    && Boolean(article.featuredImageAlt?.trim());
}

export function canonicalForArticle(siteUrl: string, slug: string, canonicalPath?: string | null): string {
  if (canonicalPath?.startsWith("https://")) return canonicalPath;
  if (canonicalPath?.startsWith("/journal/")) return `${siteUrl.replace(/\/$/, "")}${canonicalPath}`;
  return `${siteUrl.replace(/\/$/, "")}/journal/${slug}`;
}

export function scheduledArticleIsDue(scheduledFor: string | null, now: Date): boolean {
  if (!scheduledFor) return false;
  const date = new Date(scheduledFor);
  return !Number.isNaN(date.getTime()) && date.getTime() <= now.getTime();
}
