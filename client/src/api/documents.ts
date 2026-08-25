import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Document, DocumentCategory } from "./types";

export function useDocuments(systemId: string | undefined) {
  return useQuery({
    queryKey: ["systems", systemId, "documents"],
    queryFn: () => apiFetch<Document[]>(`/systems/${systemId}/documents`),
    enabled: !!systemId,
  });
}

export interface UploadDocumentInput {
  file: File;
  category: DocumentCategory;
  description?: string;
}

export function useUploadDocument(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("category", input.category);
      if (input.description) form.append("description", input.description);
      return apiFetch<Document>(`/systems/${systemId}/documents`, { method: "POST", body: form });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId, "documents"] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "audit"] });
    },
  });
}

export function useDeleteDocument(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => apiFetch<void>(`/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId, "documents"] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "audit"] });
    },
  });
}
