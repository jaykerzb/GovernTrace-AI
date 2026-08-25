import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { DocumentCategory } from "./types";

export interface DocumentSearchResult {
  id: string;
  originalName: string;
  category: DocumentCategory;
  aiSystemId: string;
  aiSystemName: string;
  snippet: string | null;
}

export function useDocumentSearch(query: string) {
  return useQuery({
    queryKey: ["document-search", query],
    queryFn: () => apiFetch<DocumentSearchResult[]>(`/documents/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });
}
