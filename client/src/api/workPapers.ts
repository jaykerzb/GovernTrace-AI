import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { CompositeRiskRating, FunctionWorkPaper, FunctionWorkPaperDetail, OverallRecommendation, SectionData } from "./types";

export function useWorkPapers(systemId: string | undefined) {
  return useQuery({
    queryKey: ["systems", systemId, "work-papers"],
    queryFn: () => apiFetch<FunctionWorkPaper[]>(`/systems/${systemId}/work-papers`),
    enabled: !!systemId,
  });
}

export function useWorkPaper(id: string | undefined) {
  return useQuery({
    queryKey: ["work-papers", id],
    queryFn: () => apiFetch<FunctionWorkPaperDetail>(`/work-papers/${id}`),
    enabled: !!id,
  });
}

export interface WorkPaperUpdate {
  answers: Record<string, string>;
  questionNotes?: Record<string, string>;
  sectionData?: Record<string, SectionData>;
  compositeRiskRating?: CompositeRiskRating | null;
  overallRecommendation?: OverallRecommendation | null;
  keyFindings?: string | null;
  rationale?: string | null;
  reviewerName?: string | null;
  reviewerTitle?: string | null;
  reviewerDate?: string | null;
}

export function useSaveWorkPaper(id: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: WorkPaperUpdate) =>
      apiFetch<FunctionWorkPaperDetail>(`/work-papers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-papers", id] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "work-papers"] });
    },
  });
}

export function useCompleteWorkPaper(id: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<FunctionWorkPaperDetail>(`/work-papers/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-papers", id] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "work-papers"] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "audit"] });
    },
  });
}

export function useReopenWorkPaper(id: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<FunctionWorkPaperDetail>(`/work-papers/${id}/reopen`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-papers", id] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "work-papers"] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "audit"] });
    },
  });
}
