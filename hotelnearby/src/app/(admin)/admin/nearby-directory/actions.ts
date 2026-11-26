"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformRoles } from "@/features/auth/authorization";

const httpsOrEmpty=z.union([z.literal(""),z.string().url().refine(v=>v.startsWith("https://"))]);
function uuidList(fd:FormData,key:string){return [...new Set(fd.getAll(key).map(String).filter(v=>z.string().uuid().safeParse(v).success))].slice(0,30)}
async function context(permission:"destinations.manage"|"events.manage"){
 const c=await requirePlatformRoles(["administrator","editor_moderator"]);
 if(c.profile.role!=="administrator") { const {data,error}=await c.supabase.rpc("has_staff_permission",{p_permission_key:permission}); if(error||data!==true) redirect("/account/profile"); }
 return c;
}
export async function saveDirectoryItem(fd:FormData){
 const kind=String(fd.get("kind")); if(!["event","attraction","business"].includes(kind)) redirect("/admin/nearby-directory?error=validation"); const table=kind==="event"?"events":kind==="attraction"?"attractions":"local_businesses";
 const permission=kind==="event"?"events.manage":"destinations.manage"; const {supabase,user}=await context(permission);
 const categorySchema=kind==="event"?z.enum(["concert","festival","conference","exhibition","sports","trade_fair","cultural","community","other"]):kind==="attraction"?z.enum(["attraction","museum","heritage","nature","religious","entertainment","sport","gallery","cultural_site","zoo","beach","waterfall","monument","other"]):z.enum(["restaurant","cafe","shopping","event_centre","park","gym","spa","hospital","university","airport","transport_terminal","other"]);
 const schema=z.object({id:z.string().uuid().optional(),location_id:z.string().uuid(),name:z.string().trim().min(kind==="event"?3:2).max(160),slug:z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),category:categorySchema,description:z.string().trim().min(40).max(4000),address_line:z.string().max(300),latitude:z.coerce.number().min(-90).max(90),longitude:z.coerce.number().min(-180).max(180),image_url:httpsOrEmpty,website_url:httpsOrEmpty,source_reference:z.string().url().max(500),organiser_name:z.string().trim().min(2).max(160).optional(),organiser_contact:z.string().max(254).optional(),starts_at:z.string().min(1).optional(),ends_at:z.string().optional(),venue_name:z.string().max(160).optional(),ticket_url:httpsOrEmpty.optional(),phone_number:z.string().max(40).optional()});
 const parsed=schema.safeParse(Object.fromEntries(fd.entries())); if(!parsed.success) redirect(kind==="event"?"/admin/events?error=validation":"/admin/nearby-directory?error=validation");
 const v=parsed.data;
 if(kind==="event"){
  const start=v.starts_at?new Date(`${v.starts_at}:00+01:00`).getTime():NaN;
  const end=v.ends_at?.trim()?new Date(`${v.ends_at}:00+01:00`).getTime():null;
  if(!v.organiser_name?.trim()||!Number.isFinite(start)||(end!==null&&(!Number.isFinite(end)||end<start))) redirect("/admin/events?error=event-dates");
 }
 const payload:any={location_id:v.location_id,slug:v.slug,description:v.description,address_line:v.address_line||null,latitude:v.latitude,longitude:v.longitude,image_url:v.image_url||null,website_url:v.website_url||null,source_reference:v.source_reference,verification_status:"unverified",publication_status:"in_review",reviewed_by:null,reviewed_at:null,published_at:null};
 if(kind==="event") Object.assign(payload,{title:v.name,event_type:v.category,organiser_name:v.organiser_name,organiser_contact:v.organiser_contact||null,starts_at:v.starts_at?new Date(`${v.starts_at}:00+01:00`).toISOString():null,ends_at:v.ends_at?.trim()?new Date(`${v.ends_at}:00+01:00`).toISOString():null,venue_name:v.venue_name||null,ticket_url:v.ticket_url||null});
 else if(kind==="attraction") Object.assign(payload,{name:v.name,category:v.category});
 else Object.assign(payload,{name:v.name,business_type:v.category,phone_number:v.phone_number||null});
 const id=v.id; const result=id?await supabase.from(table).update(payload).eq("id",id).select("id").single():await supabase.from(table).insert(payload).select("id").single();
 if(result.error||!result.data) redirect(kind==="event"?"/admin/events?error=save":"/admin/nearby-directory?error=save");
 const related=uuidList(fd,"property_ids"); if(related.length){const {data:validProperties,error:propertyError}=await supabase.from("properties").select("id").in("id",related).eq("location_id",v.location_id).eq("approval_status","approved").eq("is_active",true);if(propertyError||validProperties?.length!==related.length) redirect(kind==="event"?"/admin/events?error=property-links":"/admin/nearby-directory?error=property-links");} const linkTable=kind==="event"?"event_related_properties":kind==="attraction"?"attraction_related_properties":"business_related_properties"; const fk=kind==="event"?"event_id":kind==="attraction"?"attraction_id":"business_id";
 const {error:deleteLinksError}=await supabase.from(linkTable).delete().eq(fk,result.data.id); if(deleteLinksError) redirect(kind==="event"?"/admin/events?error=links":"/admin/nearby-directory?error=links"); if(related.length){const {error}=await supabase.from(linkTable).insert(related.map((property_id,display_order)=>({[fk]:result.data.id,property_id,display_order})));if(error) redirect(kind==="event"?"/admin/events?error=links":"/admin/nearby-directory?error=links");}
 revalidatePath("/nearby");revalidatePath("/events");revalidatePath("/admin/nearby-directory");revalidatePath("/admin/events");
 redirect(kind==="event"?"/admin/events?saved=1":"/admin/nearby-directory?saved=1");
}
export async function moderateDirectoryItem(fd:FormData){
 const kind=String(fd.get("kind"));const id=String(fd.get("id"));const decision=String(fd.get("decision"));if(!["event","attraction","business"].includes(kind)) redirect("/admin/nearby-directory?error=moderation");const table=kind==="event"?"events":kind==="attraction"?"attractions":"local_businesses";const {supabase,user}=await context(kind==="event"?"events.manage":"destinations.manage");
 if(!z.string().uuid().safeParse(id).success||!(["publish","reject","unpublish","cancel"].includes(decision))) redirect("/admin/nearby-directory?error=moderation");
 const payload=decision==="publish"?{verification_status:"verified",publication_status:"published",reviewed_by:user.id,reviewed_at:new Date().toISOString(),published_at:new Date().toISOString()}:decision==="cancel"?{publication_status:"cancelled",published_at:null}:decision==="reject"?{verification_status:"disputed",publication_status:"unpublished",reviewed_by:user.id,reviewed_at:new Date().toISOString(),published_at:null}:{publication_status:"unpublished",published_at:null};
 const {error}=await supabase.from(table).update(payload).eq("id",id);if(error) redirect(kind==="event"?"/admin/events?error=publish":"/admin/nearby-directory?error=publish");
 revalidatePath("/nearby");revalidatePath("/events");revalidatePath("/admin/nearby-directory");revalidatePath("/admin/events");redirect(kind==="event"?"/admin/events?saved=1":"/admin/nearby-directory?saved=1");
}
