import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface AnalyticsData {
  riskDistribution: Record<string, number>;
  registrationsByMonth: { month: string; count: number }[];
  byBusinessUnit: { businessUnit: string; count: number }[];
  workloadByFunction: { functionKey: string; label: string; count: number }[];
  avgDaysToDecision: number | null;
  decisionSampleSize: number;
}

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiFetch<AnalyticsData>("/analytics"),
    refetchInterval: 15000,
  });
}
