import { notFound } from "next/navigation";
import { requireJournalEditor } from "@/features/journal/authorization";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { JournalMarkdown } from "@/features/journal/markdown";

export const metadata = { title: "Article preview | Hotelnearby", robots: { index: false, follow: false, noarchive: true } };
export default async function JournalPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase } = await requireJournalEditor();
  const { data: article } = await supabase.from("blog_articles").select("*,category:blog_categories(name)").eq("id", id).maybeSingle(); if (!article) notFound();
  return <Section spacing="lg"><Container size="narrow"><div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-sm font-bold text-amber-950">Private editorial preview · Not publicly indexed</div><p className="text-xs font-extrabold uppercase tracking-wider text-accent-text">{(article.category as any)?.name ?? "Travel Journal"}</p><Heading as="h1" size="display" className="mt-3">{article.title}</Heading><Text tone="muted" className="mt-3">By {article.author_display_name} · {article.status}</Text>{article.featured_image_url ? <img src={article.featured_image_url} alt={article.featured_image_alt ?? ""} className="mt-8 max-h-[520px] w-full rounded-2xl object-cover"/> : null}<p className="mt-8 text-xl text-muted-foreground">{article.excerpt}</p><div className="mt-8"><JournalMarkdown content={article.body_markdown}/></div></Container></Section>;
}
