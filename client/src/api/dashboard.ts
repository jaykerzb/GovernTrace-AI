import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { DashboardData } from "./types";

// Shared with SidebarQuickStats, which renders on every authenticated page
// (not just the Dashboard) — that component passes a much longer interval
// since a summary badge doesn't need 15s freshness, whereas the Dashboard
// page itself wants to feel live. React Query dedupes both callers onto one
// cached query and polls at whichever active interval is shortest, so this
// stays a single request either way — passing a longer interval here just
// stops that shared poll from running every 15s site-wide when only the
// sidebar (not the Dashboard) is mounted.
export function useDashboard(intervalMs = 15000) {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardData>("/dashboard"),
    refetchInterval: intervalMs,
  });
}
