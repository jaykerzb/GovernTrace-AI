import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "recently-viewed-systems";
const MAX_ENTRIES = 5;

export interface RecentlyViewedEntry {
  id: string;
  name: string;
  viewedAt: string;
}

const listeners = new Set<() => void>();

let cachedSnapshot: RecentlyViewedEntry[] | null = null;

function readEntries(): RecentlyViewedEntry[] {
  if (cachedSnapshot) return cachedSnapshot;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cachedSnapshot = raw ? (JSON.parse(raw) as RecentlyViewedEntry[]) : [];
  } catch {
    cachedSnapshot = [];
  }
  return cachedSnapshot;
}

function writeEntries(entries: RecentlyViewedEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  cachedSnapshot = entries;
  listeners.forEach((l) => l());
}

export function recordRecentlyViewed(id: string, name: string) {
  const existing = readEntries().filter((e) => e.id !== id);
  const next = [{ id, name, viewedAt: new Date().toISOString() }, ...existing].slice(0, MAX_ENTRIES);
  writeEntries(next);
}

export function removeRecentlyViewed(id: string) {
  const next = readEntries().filter((e) => e.id !== id);
  if (next.length !== readEntries().length) writeEntries(next);
}

export function useRecordRecentlyViewed(id: string | undefined, name: string | undefined) {
  useEffect(() => {
    if (id && name) recordRecentlyViewed(id, name);
  }, [id, name]);
}

// Drops any cached entry whose system no longer exists — catches use cases
// deleted (manually, or auto-cleaned as an abandoned draft) in a different
// tab/session, or before this cleanup existed. Runs once per mount of
// whatever calls it (the sidebar), which is enough since the list only ever
// grows through actively viewing a system.
export async function pruneRecentlyViewed() {
  const entries = readEntries();
  if (entries.length === 0) return;

  const results = await Promise.all(
    entries.map(async (e) => {
      try {
        const res = await fetch(`/api/systems/${e.id}`, { credentials: "include" });
        if (res.status === 404) return null;
        return e;
      } catch {
        // Network hiccup — keep the entry rather than dropping it speculatively.
        return e;
      }
    })
  );
  const stillValid = results.filter((e): e is RecentlyViewedEntry => e !== null);
  if (stillValid.length !== entries.length) writeEntries(stillValid);
}

export function useRecentlyViewed(): RecentlyViewedEntry[] {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    readEntries,
    () => []
  );
}
