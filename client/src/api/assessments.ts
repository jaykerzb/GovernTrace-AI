import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { ClassificationOptions, Question, RiskAssessment } from "./types";

export function useQuestionnaire() {
  return useQuery({
    queryKey: ["questionnaire"],
    queryFn: () => apiFetch<Question[]>("/questionnaire"),
    staleTime: Infinity,
  });
}

export function useClassificationOptions() {
  return useQuery({
    queryKey: ["classification-options"],
    queryFn: () => apiFetch<ClassificationOptions>("/classification-options"),
    staleTime: Infinity,
  });
}

export function useAssessments(systemId: string | undefined) {
  return useQuery({
    queryKey: ["systems", systemId, "assessments"],
    queryFn: () => apiFetch<RiskAssessment[]>(`/systems/${systemId}/assessments`),
    enabled: !!systemId,
  });
}

export function useStartAssessment(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<RiskAssessment>(`/systems/${systemId}/assessments`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "assessments"] });
      qc.invalidateQueries({ queryKey: ["systems"] });
    },
  });
}

export interface AssessmentUpdate {
  answers: Record<string, string>;
  deliveryModel?: string | null;
  capabilityTier?: string | null;
  riskFactors?: number[];
}

export function useSaveAssessmentAnswers(assessmentId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: AssessmentUpdate) =>
      apiFetch<RiskAssessment>(`/assessments/${assessmentId}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId, "assessments"] });
    },
  });
}

export function useDeleteAssessment(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assessmentId: string) => apiFetch<void>(`/assessments/${assessmentId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "assessments"] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "audit"] });
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useFinalizeAssessment(assessmentId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<RiskAssessment>(`/assessments/${assessmentId}/finalize`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "assessments"] });
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
