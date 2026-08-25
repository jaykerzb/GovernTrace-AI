import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface ApprovalStep {
  id: string;
  aiSystemId: string;
  stepType: string;
  requiredRole: "ADMIN" | "COMPLIANCE_OFFICER" | "SYSTEM_OWNER" | "APPROVER" | "VIEWER";
  sortOrder: number;
  approverId: string | null;
  approver: { name: string } | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  comment: string | null;
  actedAt: string | null;
  createdAt: string;
}

export function useApprovalSteps(systemId: string | undefined) {
  return useQuery({
    queryKey: ["systems", systemId, "approval-steps"],
    queryFn: () => apiFetch<ApprovalStep[]>(`/systems/${systemId}/approval-steps`),
    enabled: !!systemId,
  });
}

export function useDecideApprovalStep(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, comment }: { id: string; status: "APPROVED" | "REJECTED"; comment?: string }) =>
      apiFetch<ApprovalStep>(`/approval-steps/${id}/decide`, { method: "POST", body: JSON.stringify({ status, comment }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems", systemId, "approval-steps"] });
      qc.invalidateQueries({ queryKey: ["systems", systemId] });
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["systems", systemId, "audit"] });
    },
  });
}
