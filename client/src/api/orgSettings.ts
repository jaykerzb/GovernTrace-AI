import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface OrgSettings {
  id: string;
  orgName: string;
  logoUrl: string | null;
  primaryColor: string;
  approvalAuthorityLowLabel: string;
  approvalAuthorityHighLabel: string;
  showApprovalAuthorityLabels: boolean;
  approvalThreshold: number;
  reassessmentCadenceDays: number;
  riskBandLowMax: number;
  riskBandModerateMax: number;
  riskBandHighMax: number;
  updatedAt: string;
}

export interface OrgSettingsUpdate {
  orgName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  approvalAuthorityLowLabel?: string;
  approvalAuthorityHighLabel?: string;
  showApprovalAuthorityLabels?: boolean;
  approvalThreshold?: number;
  reassessmentCadenceDays?: number;
  riskBandLowMax?: number;
  riskBandModerateMax?: number;
  riskBandHighMax?: number;
}

export function useOrgSettings() {
  return useQuery({
    queryKey: ["org-settings"],
    queryFn: () => apiFetch<OrgSettings>("/org-settings"),
    // Branding rarely changes; a long staleTime avoids refetching it on
    // every navigation while still picking up admin edits within a session.
    staleTime: 60_000,
  });
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: OrgSettingsUpdate) =>
      apiFetch<OrgSettings>("/org-settings", { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-settings"] }),
  });
}
