import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { SystemStatus } from "./types";

export interface AnalyticsData {
  riskDistribution: Record<string, number>;
  registrationsByMonth: { month: string; count: number }[];
  byBusinessUnit: { businessUnit: string; count: number }[];
  workloadByFunction: { functionKey: string; label: string; count: number }[];
  avgDaysToDecision: number | null;
  decisionSampleSize: number;
}

export interface AnalyticsFilters {
  businessUnit?: string;
  status?: SystemStatus;
  dateFrom?: string;
  dateTo?: string;
}

function toQueryString(filters: AnalyticsFilters): string {
  const params = new URLSearchParams();
  if (filters.businessUnit) params.set("businessUnit", filters.businessUnit);
  if (filters.status) params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useAnalytics(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ["analytics", filters],
    queryFn: () => apiFetch<AnalyticsData>(`/analytics${toQueryString(filters)}`),
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
  });
}

export function useAnalyticsBusinessUnits() {
  return useQuery({
    queryKey: ["analytics-business-units"],
    queryFn: () => apiFetch<string[]>("/analytics/business-units"),
  });
}
