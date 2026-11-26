"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireJournalEditor } from "@/features/journal/authorization";
import { isPublishReady } from "@/features/journal/rules";

const schema = z.object({
  id: z.string().uuid().optional(), author_id: z.string().uuid().optional(), title: z.string().trim().min(5).max(160), slug: z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().max(400).default(""), body_markdown: z.string().max(60000).default(""), category_id: z.string().uuid(),
  author_display_name: z.string().trim().min(2).max(80), featured_image_url: z.union([z.literal(""), z.string().url().refine((v) => v.startsWith("https://"))]).default(""),
  featured_image_alt: z.string().max(200).default(""), seo_title: z.string().max(70).default(""), seo_description: z.string().max(170).default(""),
  canonical_path: z.union([z.literal(""), z.string().max(500).refine((v) => v.startsWith("/journal/") || /^https:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?(?:\/|$)/.test(v))]).default(""), status: z.enum(["draft", "in_review", "scheduled", "published", "unpublished"]), scheduled_for: z.string().optional(),
  tag_names: z.string().max(1000).default(""), destination_ids: z.string().max(2000).default(""), property_ids: z.string().max(2000).default(""), related_article_ids: z.string().max(2000).default(""),
});

const ids = (value: string) => [...new Set(value.split(",").map((v) => v.trim()).filter((v) => z.string().uuid().safeParse(v).success))].slice(0, 30);
const tags = (value: string) => [...new Set(value.split(",").map((v) => v.trim().replace(/\s+/g, " ")).filter((v) => v.length >= 2 && v.length <= 60))].slice(0, 20);
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function saveJournalArticle(formData: FormData) {
  const { supabase, user, profile } = await requireJournalEditor();
  const raw = Object.fromEntries(formData.entries());
  raw.destination_ids = formData.getAll("destination_ids").map(String).join(",");
  raw.property_ids = formData.getAll("property_ids").map(String).join(",");
  raw.related_article_ids = formData.getAll("related_article_ids").map(String).join(",");
  const parsed = schema.safeParse(raw);
  if (!parsed.success) redirect("/admin/travel-journal?error=validation");
  const input = parsed.data;
  const imageFile = formData.get("featured_image_file");
  let uploadedImageUrl = input.featured_image_url || "";
  if (imageFile instanceof File && imageFile.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(imageFile.type) || imageFile.size > 8 * 1024 * 1024) redirect("/admin/travel-journal?error=image");
    const extension = imageFile.type === "image/png" ? "png" : imageFile.type === "image/webp" ? "webp" : imageFile.type === "image/avif" ? "avif" : "jpg";
    const path = `${user.id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("journal-images").upload(path, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploadError) redirect("/admin/travel-journal?error=image");
    uploadedImageUrl = supabase.storage.from("journal-images").getPublicUrl(path).data.publicUrl;
  }
  const scheduledFor = input.status === "scheduled" ? input.scheduled_for : null;
  if (input.status === "scheduled" && (!scheduledFor || Number.isNaN(Date.parse(scheduledFor)) || Date.parse(scheduledFor) <= Date.now())) redirect("/admin/travel-journal?error=schedule");
  if (["published", "scheduled"].includes(input.status) && !isPublishReady({ bodyMarkdown: input.body_markdown, seoDescription: input.seo_description, featuredImageUrl: uploadedImageUrl, featuredImageAlt: input.featured_image_alt })) redirect("/admin/travel-journal?error=quality");
  

  const selectedAuthorId = input.author_id || user.id;
  const { data: selectedAuthor } = await supabase.from("profiles").select("id,full_name,role,account_status").eq("id", selectedAuthorId).eq("account_status", "active").maybeSingle();
  if (!selectedAuthor || !["administrator", "editor_moderator"].includes(selectedAuthor.role)) redirect("/admin/travel-journal?error=author");
  if (selectedAuthor.role === "editor_moderator") {
    if (selectedAuthorId === user.id) {
      const { data: allowed } = await supabase.rpc("has_staff_permission", { p_permission_key: "content.manage" });
      if (allowed !== true) redirect("/admin/travel-journal?error=author");
    } else if (profile.role !== "administrator") redirect("/admin/travel-journal?error=author");
    else {
      const { data: authorGrant } = await supabase.from("platform_permission_grants").select("id").eq("user_id", selectedAuthorId).eq("permission_key", "content.manage").maybeSingle();
      if (!authorGrant) redirect("/admin/travel-journal?error=author");
    }
  }
  const payload = {
    slug: input.slug, title: input.title, excerpt: input.excerpt, body_markdown: input.body_markdown,
    category_id: input.category_id, author_id: selectedAuthorId, author_display_name: input.author_display_name || profile.full_name,
    featured_image_url: uploadedImageUrl || null, featured_image_alt: input.featured_image_alt || null,
    seo_title: input.seo_title || null, seo_description: input.seo_description || null,
    canonical_path: input.canonical_path || `/journal/${input.slug}`, status: input.status,
    scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    published_at: input.status === "published" ? new Date().toISOString() : null,
    related_location_id: ids(input.destination_ids)[0] ?? null,
  };
  const query = input.id
    ? await supabase.from("blog_articles").update(payload).eq("id", input.id).select("id").single()
    : await supabase.from("blog_articles").insert(payload).select("id").single();
  if (query.error || !query.data) redirect("/admin/travel-journal?error=save");
  const articleId = query.data.id;

  const tagRows = tags(input.tag_names).map((name) => ({ name, slug: slugify(name) })).filter((tag) => tag.slug.length >= 2);
  for (const tag of tagRows) {
    const { error } = await supabase.from("blog_tags").upsert(tag, { onConflict: "slug" });
    if (error) redirect("/admin/travel-journal?error=tags");
  }
  const { data: savedTags } = tagRows.length ? await supabase.from("blog_tags").select("id,slug").in("slug", tagRows.map((t) => t.slug)) : { data: [] as {id:string;slug:string}[] };
  const operations = await Promise.all([
    supabase.from("blog_article_tags").delete().eq("article_id", articleId),
    supabase.from("blog_article_destinations").delete().eq("article_id", articleId),
    supabase.from("blog_article_properties").delete().eq("article_id", articleId),
    supabase.from("blog_article_links").delete().eq("article_id", articleId),
  ]);
  if (operations.some((item) => item.error)) redirect("/admin/travel-journal?error=links");
  const destinationIds = ids(input.destination_ids);
  const propertyIds = ids(input.property_ids);
  const articleIds = ids(input.related_article_ids).filter((id) => id !== articleId);
  const writes = [
    ...(savedTags?.length ? [supabase.from("blog_article_tags").insert(savedTags.map((tag) => ({ article_id: articleId, tag_id: tag.id })))] : []),
    ...(destinationIds.length ? [supabase.from("blog_article_destinations").insert(destinationIds.map((destination_id, display_order) => ({ article_id: articleId, destination_id, display_order })))] : []),
    ...(propertyIds.length ? [supabase.from("blog_article_properties").insert(propertyIds.map((property_id, display_order) => ({ article_id: articleId, property_id, display_order })))] : []),
    ...(articleIds.length ? [supabase.from("blog_article_links").insert(articleIds.map((linked_article_id, display_order) => ({ article_id: articleId, linked_article_id, link_label: "Related reading", display_order })))] : []),
  ];
  const results = await Promise.all(writes);
  if (results.some((item) => item.error)) redirect("/admin/travel-journal?error=links");
  revalidatePath("/journal"); revalidatePath(`/journal/${input.slug}`); revalidatePath("/admin/travel-journal");
  redirect(`/admin/travel-journal?${input.status === "published" ? "published=1" : "saved=1"}`);
}

export async function changeJournalStatus(formData: FormData) {
  const { supabase } = await requireJournalEditor();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!z.string().uuid().safeParse(id).success || !["draft", "in_review", "unpublished"].includes(status)) redirect("/admin/travel-journal?error=status");
  const { error } = await supabase.from("blog_articles").update({ status, scheduled_for: null }).eq("id", id);
  if (error) redirect("/admin/travel-journal?error=status");
  revalidatePath("/journal"); revalidatePath("/admin/travel-journal");
  redirect("/admin/travel-journal?saved=1");
}


const categorySchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(80), slug: z.string().trim().min(2).max(90).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().max(500).default(""), display_order: z.coerce.number().int().min(0).max(1000).default(0) });
export async function saveJournalCategory(formData: FormData) {
  const { supabase } = await requireJournalEditor();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/admin/travel-journal?error=category");
  const input = parsed.data;
  const result = input.id
    ? await supabase.from("blog_categories").update({ name: input.name, slug: input.slug, description: input.description, display_order: input.display_order }).eq("id", input.id)
    : await supabase.from("blog_categories").insert({ name: input.name, slug: input.slug, description: input.description, display_order: input.display_order });
  if (result.error) redirect("/admin/travel-journal?error=category");
  revalidatePath("/admin/travel-journal"); revalidatePath("/journal");
  redirect("/admin/travel-journal?saved=1");
}

export async function toggleJournalCategory(formData: FormData) {
  const { supabase } = await requireJournalEditor();
  const id = String(formData.get("id") ?? ""); const active = String(formData.get("active") ?? "") === "true";
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/travel-journal?error=category");
  const { error } = await supabase.from("blog_categories").update({ is_active: active }).eq("id", id);
  if (error) redirect("/admin/travel-journal?error=category");
  revalidatePath("/admin/travel-journal"); revalidatePath("/journal");
  redirect("/admin/travel-journal?saved=1");
}
