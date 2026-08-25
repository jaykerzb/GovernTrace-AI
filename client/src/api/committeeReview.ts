import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { CommitteeReview, FinalDisposition } from "./types";

export function useCommitteeReview(systemId: string | undefined) {
  return useQuery({
    queryKey: ["systems", systemId, "committee-review"],
    queryFn: () => apiFetch<CommitteeReview>(`/systems/${systemId}/committee-review`),
    enabled: !!systemId,
  });
}

export interface CommitteeReviewUpdate {
  crossFunctionalConflicts?: string | null;
  committeeDiscussion?: string | null;
  finalDisposition?: FinalDisposition | null;
  decisionJustification?: string | null;
}

export function useSaveCommitteeReview(id: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: CommitteeReviewUpdate) =>
      apiFetch<CommitteeReview>(`/committee-review/${id}`, { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId, "committee-review"] });
    },
  });
}

export function useFinalizeCommitteeReview(id: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<CommitteeReview>(`/committee-review/${id}/finalize`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId, "committee-review"] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "audit"] });
    },
  });
}

export function useReopenCommitteeReview(id: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<CommitteeReview>(`/committee-review/${id}/reopen`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId, "committee-review"] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "audit"] });
    },
  });
}
