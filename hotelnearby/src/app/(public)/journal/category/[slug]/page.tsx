import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { getPublicEnv } from "@/lib/env/public";

async function getCategory(slug: string) {
  const env = getPublicEnv(); if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: category } = await supabase.from("blog_categories").select("id,name,slug,description").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!category) return null;
  const { data: articles } = await supabase.from("blog_articles").select("id,slug,title,excerpt,author_display_name,published_at,featured_image_url,featured_image_alt,category_id").eq("category_id", category.id).eq("status", "published").lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(100);
  return { category, articles: articles ?? [] };
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const result = await getCategory(slug); if (!result) return { title: "Category not found", robots: { index: false, follow: false } };
  return { title: `${result.category.name} | Hotelnearby Travel Journal`, description: result.category.description, alternates: { canonical: `/journal/category/${slug}` }, robots: { index: result.articles.length > 0, follow: true } };
}
export default async function JournalCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const result = await getCategory(slug); if (!result) notFound();
  return <Section spacing="lg"><Container><Link href="/journal" className="text-sm font-bold text-accent-text underline">← Travel Journal</Link><Heading as="h1" size="display" className="mt-5">{result.category.name}</Heading><Text tone="muted" className="mt-3 max-w-2xl">{result.category.description}</Text><div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{result.articles.map((article) => <article key={article.id} className="overflow-hidden rounded-xl border border-border bg-surface"><Link href={`/journal/${article.slug}`}>{article.featured_image_url ? <img src={article.featured_image_url} alt={article.featured_image_alt ?? ""} className="aspect-[16/10] w-full object-cover"/> : <div className="aspect-[16/10] bg-surface-muted"/>}<div className="p-5"><h2 className="text-lg font-extrabold">{article.title}</h2><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p><p className="mt-4 text-xs text-muted-foreground">By {article.author_display_name}</p></div></Link></article>)}</div>{!result.articles.length ? <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">No articles in this category have been published yet.</p> : null}</Container></Section>;
}
