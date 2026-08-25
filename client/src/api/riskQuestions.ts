import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Question, QuestionOption } from "./types";

// Admin view includes inactive questions too — the public /questionnaire
// endpoint (see api/assessments.ts) only returns active ones.
export function useAdminRiskQuestions() {
  return useQuery({
    queryKey: ["admin", "risk-questions"],
    queryFn: () => apiFetch<Question[]>("/admin/risk-questions"),
  });
}

export interface CreateRiskQuestionInput {
  dimension: 1 | 2;
  text: string;
  helpText?: string;
  options: QuestionOption[];
}

export function useCreateRiskQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRiskQuestionInput) =>
      apiFetch<Question>("/admin/risk-questions", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "risk-questions"] });
      qc.invalidateQueries({ queryKey: ["questionnaire"] });
    },
  });
}

export interface UpdateRiskQuestionInput {
  id: string;
  text?: string;
  helpText?: string;
  options?: QuestionOption[];
  order?: number;
  isActive?: boolean;
}

export function useUpdateRiskQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...update }: UpdateRiskQuestionInput) =>
      apiFetch<Question>(`/admin/risk-questions/${id}`, { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "risk-questions"] });
      qc.invalidateQueries({ queryKey: ["questionnaire"] });
    },
  });
}
