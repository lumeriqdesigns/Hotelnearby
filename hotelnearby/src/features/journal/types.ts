export type JournalStatus = "draft" | "in_review" | "scheduled" | "published" | "unpublished";
export type JournalArticle = {
  id: string; slug: string; title: string; excerpt: string; body_markdown: string;
  author_display_name: string; featured_image_url: string | null; featured_image_alt: string | null;
  seo_title: string | null; seo_description: string | null; canonical_path: string | null;
  status: JournalStatus; scheduled_for: string | null; published_at: string | null;
  category_id: string; category?: { name: string; slug: string } | null;
};
