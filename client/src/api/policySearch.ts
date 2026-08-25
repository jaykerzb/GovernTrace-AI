import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { PolicyCategory } from "./types";

export interface PolicySearchResult {
  id: string;
  title: string;
  category: PolicyCategory;
  snippet: string | null;
}

export function usePolicySearch(query: string) {
  return useQuery({
    queryKey: ["policy-search", query],
    queryFn: () => apiFetch<PolicySearchResult[]>(`/policies/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });
}
