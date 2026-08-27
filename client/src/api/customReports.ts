import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { AnalyticsFilters } from "./analytics";

export const CUSTOM_DIMENSIONS = ["businessUnit", "status", "aiType", "owner", "riskRating", "month"] as const;
export type CustomDimension = (typeof CUSTOM_DIMENSIONS)[number];

export const CUSTOM_METRICS = ["count", "avgScore"] as const;
export type CustomMetric = (typeof CUSTOM_METRICS)[number];

export const CUSTOM_CHART_TYPES = ["bar", "donut", "column", "table"] as const;
export type CustomChartType = (typeof CUSTOM_CHART_TYPES)[number];

export const DIMENSION_LABELS: Record<CustomDimension, string> = {
  businessUnit: "Business Unit",
  status: "Status",
  aiType: "AI Type",
  owner: "Owner",
  riskRating: "Risk Rating",
  month: "Month Registered",
};

export const METRIC_LABELS: Record<CustomMetric, string> = {
  count: "Count of Use Cases",
  avgScore: "Average Risk Score",
};

export const CHART_TYPE_LABELS: Record<CustomChartType, string> = {
  bar: "Bar",
  donut: "Donut",
  column: "Column",
  table: "Table",
};

export interface CustomReportSpec {
  id: string;
  title: string;
  dimension: CustomDimension;
  metric: CustomMetric;
  chartType: CustomChartType;
}

export interface CustomReportRow {
  label: string;
  value: number;
}

export interface CustomReportData {
  dimension: CustomDimension;
  metric: CustomMetric;
  data: CustomReportRow[];
}

function toQueryString(dimension: CustomDimension, metric: CustomMetric, filters: AnalyticsFilters): string {
  const params = new URLSearchParams({ dimension, metric });
  if (filters.businessUnit) params.set("businessUnit", filters.businessUnit);
  if (filters.status) params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}

export function useCustomReportData(dimension: CustomDimension, metric: CustomMetric, filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ["analytics-custom", dimension, metric, filters],
    queryFn: () => apiFetch<CustomReportData>(`/analytics/custom?${toQueryString(dimension, metric, filters)}`),
    refetchInterval: 15000,
  });
}

// Saved report configs are per-browser (localStorage), not shared across
// users — there's no server model for them, keeping this a lightweight
// personalization feature rather than a new piece of shared org state.
const STORAGE_KEY = "governtrace-custom-reports";

export function loadCustomReports(): CustomReportSpec[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomReports(reports: CustomReportSpec[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Ignore — a private window or a full storage quota just means the
    // report list won't persist across reloads, not a functional failure.
  }
}
