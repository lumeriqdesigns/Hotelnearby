import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { JournalMarkdown } from "@/features/journal/markdown";
import { getPublicEnv } from "@/lib/env/public";
import { canonicalForArticle } from "@/features/journal/rules";

async function getArticle(slug: string) {
  const env = getPublicEnv(); if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await supabase.from("blog_articles").select("id,slug,title,excerpt,body_markdown,author_display_name,featured_image_url,featured_image_alt,seo_title,seo_description,canonical_path,published_at,category:blog_categories(name,slug),tags:blog_article_tags(tag:blog_tags(name,slug)),destinations:blog_article_destinations(destination:location_nodes(name,slug,level,is_active)),properties:blog_article_properties(property:properties(name,slug,approval_status,is_active)),related:blog_article_links(linked:blog_articles!blog_article_links_linked_article_id_fkey(slug,title,excerpt,status,published_at))").eq("slug", slug).eq("status", "published").lte("published_at", new Date().toISOString()).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const article = await getArticle(slug); if (!article) return { title: "Article not found", robots: { index: false, follow: false } };
  const env = getPublicEnv(); const canonical = canonicalForArticle(env.siteUrl, article.slug, article.canonical_path);
  return { title: article.seo_title || article.title, description: article.seo_description || article.excerpt, alternates: { canonical }, openGraph: { type: "article", title: article.seo_title || article.title, description: article.seo_description || article.excerpt, url: canonical, images: article.featured_image_url ? [{ url: article.featured_image_url, alt: article.featured_image_alt ?? article.title }] : undefined, publishedTime: article.published_at ?? undefined }, twitter: { card: "summary_large_image", title: article.seo_title || article.title, description: article.seo_description || article.excerpt, images: article.featured_image_url ? [article.featured_image_url] : undefined } };
}

export default async function JournalArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const article = await getArticle(slug); if (!article) notFound();
  const env = getPublicEnv(); const canonical = canonicalForArticle(env.siteUrl, article.slug, article.canonical_path);
  const category = article.category as any; const destinations = ((article.destinations ?? []) as any[]).filter((item) => item.destination?.is_active); const properties = ((article.properties ?? []) as any[]).filter((item) => item.property?.approval_status === "approved" && item.property?.is_active); const related = ((article.related ?? []) as any[]).filter((item) => item.linked?.status === "published" && item.linked?.published_at && new Date(item.linked.published_at) <= new Date()); const tags = (article.tags ?? []) as any[];
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.seo_description || article.excerpt, image: article.featured_image_url ? [article.featured_image_url] : undefined, datePublished: article.published_at, author: { "@type": "Person", name: article.author_display_name }, publisher: { "@type": "Organization", name: "Hotelnearby" }, mainEntityOfPage: canonical };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <Section spacing="lg"><Container size="narrow"><nav aria-label="Breadcrumb" className="mb-7 text-sm text-muted-foreground"><Link href="/" className="underline">Home</Link> / <Link href="/journal" className="underline">Travel Journal</Link> / {category?.name ?? "Article"}</nav>
      <p className="text-xs font-extrabold uppercase tracking-[.18em] text-accent-text">{category?.name ?? "Travel guide"}</p><Heading as="h1" size="display" className="mt-3">{article.title}</Heading><Text tone="muted" className="mt-4">By {article.author_display_name}{article.published_at ? ` · ${new Date(article.published_at).toLocaleDateString()}` : ""}</Text>
      {article.featured_image_url ? <figure className="mt-8 overflow-hidden rounded-2xl bg-surface-muted"><img src={article.featured_image_url} alt={article.featured_image_alt ?? ""} className="max-h-[560px] w-full object-cover"/><figcaption className="sr-only">{article.featured_image_alt}</figcaption></figure> : null}
      {article.excerpt ? <p className="mt-8 text-xl leading-8 text-muted-foreground">{article.excerpt}</p> : null}
      <div className="mt-8"><JournalMarkdown content={article.body_markdown}/></div>
      {tags.length ? <div className="mt-10 flex flex-wrap gap-2">{tags.map((item, i) => <span key={i} className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold">{item.tag?.name}</span>)}</div> : null}
    </Container></Section>
    {(destinations.length || properties.length || related.length) ? <Section tone="muted" spacing="lg"><Container><Heading as="h2" size="h2">Explore more with Hotelnearby</Heading><div className="mt-5 grid gap-5 md:grid-cols-3">
      {destinations.length ? <div className="rounded-xl border border-border bg-surface p-5"><h3 className="font-extrabold">Destinations in this guide</h3><ul className="mt-3 space-y-2">{destinations.map((item, i) => item.destination?.slug ? <li key={i}><Link className="text-sm font-semibold text-accent-text underline" href={`/destinations/${item.destination.slug}`}>{item.destination.name}</Link></li> : null)}</ul></div> : null}
      {properties.length ? <div className="rounded-xl border border-border bg-surface p-5"><h3 className="font-extrabold">Related accommodation</h3><ul className="mt-3 space-y-2">{properties.map((item, i) => item.property?.slug ? <li key={i}><Link className="text-sm font-semibold text-accent-text underline" href={`/properties/${item.property.slug}`}>{item.property.name}</Link></li> : null)}</ul></div> : null}
      {related.length ? <div className="rounded-xl border border-border bg-surface p-5"><h3 className="font-extrabold">Related reading</h3><ul className="mt-3 space-y-2">{related.map((item, i) => item.linked?.slug ? <li key={i}><Link className="text-sm font-semibold text-accent-text underline" href={`/journal/${item.linked.slug}`}>{item.linked.title}</Link></li> : null)}</ul></div> : null}
    </div></Container></Section> : null}
  </>;
}
