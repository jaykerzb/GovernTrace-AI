import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface Triggers {
  deliveryModels: number[];
  capabilityTiers: number[];
  riskFactors: number[];
}

export interface ReviewFunctionQuestion {
  id: string;
  text: string;
  citation: string;
  isActive: boolean;
}

export interface ReviewFunctionSection {
  id: string;
  title: string;
  triggerLabel: string;
  triggers: Triggers;
  isActive: boolean;
  questions: ReviewFunctionQuestion[];
}

export interface ReviewFunctionDef {
  id: string;
  label: string;
  triggers: Triggers;
  isActive: boolean;
  sections: ReviewFunctionSection[];
}

// Lightweight key/label list — any authenticated role.
export function useReviewFunctionLabels() {
  return useQuery({
    queryKey: ["review-functions", "labels"],
    queryFn: () => apiFetch<{ key: string; label: string }[]>("/review-functions"),
    staleTime: 60_000,
  });
}

export function useReviewFunctionLabel() {
  const { data } = useReviewFunctionLabels();
  const byKey = new Map((data ?? []).map((f) => [f.key, f.label]));
  return (key: string) => byKey.get(key) ?? key;
}

// Full nested tree, including inactive — admin only.
export function useAdminReviewFunctions() {
  return useQuery({
    queryKey: ["admin", "review-functions"],
    queryFn: () => apiFetch<ReviewFunctionDef[]>("/admin/review-functions"),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin", "review-functions"] });
  qc.invalidateQueries({ queryKey: ["review-functions"] });
}

export function useCreateReviewFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; triggers?: Triggers }) =>
      apiFetch("/admin/review-functions", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateReviewFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...update }: { key: string; label?: string; triggers?: Triggers; isActive?: boolean; sortOrder?: number }) =>
      apiFetch(`/admin/review-functions/${key}`, { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ functionKey, ...input }: { functionKey: string; title: string; triggerLabel?: string; triggers: Triggers }) =>
      apiFetch(`/admin/review-functions/${functionKey}/sections`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      ...update
    }: {
      key: string;
      title?: string;
      triggerLabel?: string;
      triggers?: Triggers;
      isActive?: boolean;
      sortOrder?: number;
    }) => apiFetch(`/admin/review-functions/sections/${key}`, { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionKey, ...input }: { sectionKey: string; text: string; citation?: string }) =>
      apiFetch(`/admin/review-functions/sections/${sectionKey}/questions`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...update }: { key: string; text?: string; citation?: string; isActive?: boolean; sortOrder?: number }) =>
      apiFetch(`/admin/review-functions/questions/${key}`, { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => invalidateAll(qc),
  });
}
