"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { VisitorProperty } from "./types";
import { VISITOR_STORAGE_KEY } from "./types";

type Store = { catalogue: VisitorProperty[]; saved: { id: string; list: string }[]; recent: VisitorProperty[]; compare: VisitorProperty[]; checklists: string[] };
const empty: Store = { catalogue: [], saved: [], recent: [], compare: [], checklists: [] };
function readStore(): Store {
  try { const raw = localStorage.getItem(VISITOR_STORAGE_KEY); return raw ? { ...empty, ...JSON.parse(raw) } : empty; } catch { return empty; }
}
function writeStore(store: Store) { localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(store)); }

export function VisitorPropertyActions({ property }: { property: VisitorProperty }) {
  const [saved, setSaved] = useState(false);
  const [compared, setCompared] = useState(false);
  const [message, setMessage] = useState("");
  const [listName, setListName] = useState("Saved");
  useEffect(() => {
    const store = readStore();
    setSaved(store.saved.some((item) => item.id === property.id && item.list === "Saved"));
    setCompared(store.compare.some((item) => item.id === property.id));
    const recent = [property, ...store.recent.filter((item) => item.id !== property.id)].slice(0, 30);
    writeStore({ ...store, catalogue: [property, ...store.catalogue.filter((item) => item.id !== property.id)].slice(0, 60), recent });
    void fetch("/api/visitor-tools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "recent", propertyId: property.id }) }).catch(() => undefined);
  }, [property]);

  async function toggleSave() {
    const store = readStore();
    const normalizedList = listName.trim().slice(0, 60) || "Saved";
    const next = saved ? store.saved.filter((item) => !(item.id === property.id && item.list === normalizedList)) : [...store.saved, { id: property.id, list: normalizedList }].slice(-200);
    writeStore({ ...store, catalogue: [property, ...store.catalogue.filter((item) => item.id !== property.id)].slice(0, 60), saved: next }); setSaved(!saved); setMessage(saved ? "Removed from saved properties." : "Saved to your travel list.");
    const response = await fetch("/api/visitor-tools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: saved ? "unsave" : "save", propertyId: property.id, listName: normalizedList }) });
    if (response.status === 401) setMessage((saved ? "Removed locally. " : "Saved on this device. ") + "Sign in to sync across devices.");
    else if (!response.ok) setMessage("Saved on this device; account sync could not be completed.");
  }
  async function toggleCompare() {
    const store = readStore();
    if (compared) {
      writeStore({ ...store, compare: store.compare.filter((item) => item.id !== property.id) }); setCompared(false);
      await fetch("/api/visitor-tools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "uncompare", propertyId: property.id }) });
      return;
    }
    if (store.compare.length >= 3) { setMessage("You can compare up to three properties. Remove one first."); return; }
    writeStore({ ...store, catalogue: [property, ...store.catalogue.filter((item) => item.id !== property.id)].slice(0, 60), compare: [...store.compare, property] }); setCompared(true); setMessage("Added to comparison.");
    const response = await fetch("/api/visitor-tools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "compare", propertyId: property.id }) });
    if (response.status === 409) { setMessage("Your account comparison already contains three properties."); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">Wishlist <input aria-label="Wishlist name" value={listName} onChange={(event) => { const value = event.target.value.slice(0,60); setListName(value); setSaved(readStore().saved.some((item) => item.id === property.id && item.list === (value.trim() || "Saved"))); }} maxLength={60} className="h-9 w-28 rounded-lg border border-input-border bg-background px-2 text-sm text-foreground" /></label>
    <button type="button" onClick={toggleSave} aria-pressed={saved} className="min-h-10 rounded-lg border border-input-border px-3 text-sm font-bold hover:bg-surface-muted">{saved ? "♥ Saved" : "♡ Save property"}</button>
    <button type="button" onClick={toggleCompare} aria-pressed={compared} className="min-h-10 rounded-lg border border-input-border px-3 text-sm font-bold hover:bg-surface-muted">{compared ? "✓ Comparing" : "Compare"}</button>
    <Link href="/my-travel" className="min-h-10 inline-flex items-center rounded-lg border border-input-border px-3 text-sm font-bold hover:bg-surface-muted">My travel</Link>
    {message ? <span role="status" className="w-full text-xs text-muted-foreground">{message}</span> : null}
  </div>;
}
