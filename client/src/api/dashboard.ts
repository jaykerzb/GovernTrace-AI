import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { DashboardData } from "./types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardData>("/dashboard"),
    // Lightweight polling so the dashboard feels live without adding a
    // websocket/SSE channel for this scale of app.
    refetchInterval: 15000,
  });
}
