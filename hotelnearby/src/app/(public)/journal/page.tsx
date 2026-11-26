import Link from "next/link";
import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { getPublicEnv } from "@/lib/env/public";

export async function generateMetadata(): Promise<Metadata> {
  const env = getPublicEnv();
  let hasArticles = false;
  if (env.supabaseUrl && env.supabaseAnonKey) {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const db = await createSupabaseServerClient();
    const { count } = await db.from("blog_articles").select("id", { count: "exact", head: true }).eq("status", "published").lte("published_at", new Date().toISOString());
    hasArticles = (count ?? 0) > 0;
  }
  return { title: "Travel Journal | Hotelnearby", description: "Destination guides, travel tips, accommodation advice and local stories to help you make informed travel decisions across Nigeria.", alternates: { canonical: "/journal" }, robots: { index: hasArticles, follow: true } };
}

export default async function TravelJournalPage() {
  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) return <Section spacing="lg"><Container size="narrow"><Heading as="h1" size="display">Travel Journal</Heading><Text tone="muted" className="mt-4">Travel guides will appear here when editorial content is published.</Text></Container></Section>;
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const [{ data: articles }, { data: categories }] = await Promise.all([
    supabase.from("blog_articles").select("id,slug,title,excerpt,author_display_name,published_at,featured_image_url,featured_image_alt,category_id,category:blog_categories(name,slug)").eq("status", "published").lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(30),
    supabase.from("blog_categories").select("id,name,slug,description").eq("is_active", true).order("display_order"),
  ]);
  return <>
    <Section tone="brand" spacing="lg"><Container><p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-surface-accent">Hotelnearby · Explore better</p><Heading as="h1" size="display" className="mt-3 text-white">The Travel Journal.</Heading><Text size="body-lg" className="mt-4 max-w-2xl text-brand-surface-muted">Thoughtful destination guides, practical travel advice and local stories—written to help you make informed travel decisions.</Text></Container></Section>
    <Section spacing="lg"><Container><div className="mb-7 flex flex-wrap gap-2">{(categories ?? []).filter((c) => (articles ?? []).some((article) => article.category_id === c.id)).map((c) => <Link key={c.id} href={`/journal/category/${c.slug}`} className="rounded-full border border-border px-3 py-2 text-sm font-semibold hover:border-primary">{c.name}</Link>)}</div>
      {articles?.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{articles.map((article) => <article key={article.id} className="overflow-hidden rounded-2xl border border-border bg-surface"><Link href={`/journal/${article.slug}`} className="block">{article.featured_image_url ? <div className="aspect-[16/10] overflow-hidden bg-surface-muted"><img src={article.featured_image_url} alt={article.featured_image_alt ?? ""} loading="lazy" className="h-full w-full object-cover" /></div> : <div className="aspect-[16/10] bg-surface-muted"/>}<div className="p-5"><p className="text-xs font-extrabold uppercase tracking-wider text-accent-text">{(article.category as any)?.name ?? "Travel guide"}</p><h2 className="mt-2 text-xl font-extrabold leading-snug">{article.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{article.excerpt}</p><p className="mt-5 text-xs text-muted-foreground">By {article.author_display_name}{article.published_at ? ` · ${new Date(article.published_at).toLocaleDateString()}` : ""}</p></div></Link></article>)}</div> : <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Heading as="h2" size="h2">Good travel advice takes research.</Heading><Text tone="muted" className="mt-3">Our editors are preparing destination guides and practical local resources. Articles will appear here after review.</Text></div>}
    </Container></Section>
  </>;
}
