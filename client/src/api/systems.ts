import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { removeRecentlyViewed } from "../hooks/useRecentlyViewed";
import type { AiSystem, AiSystemDetail, AiType, SystemStatus } from "./types";

export interface SystemInput {
  useCaseId?: string | null;
  dateSubmitted?: string | null;
  name: string;
  description: string;
  capabilityCategory?: string | null;
  businessUnit: string;
  aitoCoordinator?: string | null;
  sponsorName?: string | null;
  ownerId: string;
  applicationName?: string | null;
  aiType: AiType;
  vendorName?: string | null;
  projectedCost?: number | null;
  targetDeploymentDate?: string | null;
  purpose?: string;
  businessJustification?: string | null;
  dataTypesUsed?: string;
  deploymentContext?: string;
  notes?: string | null;
  customFieldValues?: Record<string, string>;
}

export interface SystemFilters {
  status?: string;
  approvalAuthority?: string;
  ownerId?: string;
  aiType?: string;
  businessUnit?: string;
  q?: string;
}

export function useSystems(filters: SystemFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const qs = params.toString();
  return useQuery({
    queryKey: ["systems", filters],
    queryFn: () => apiFetch<AiSystem[]>(`/systems${qs ? `?${qs}` : ""}`),
  });
}

export function useSystem(id: string | undefined) {
  return useQuery({
    queryKey: ["systems", id],
    queryFn: () => apiFetch<AiSystemDetail>(`/systems/${id}`),
    enabled: !!id,
  });
}

export function useCreateSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SystemInput) =>
      apiFetch<AiSystem>("/systems", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["systems"] }),
  });
}

export function useUpdateSystem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<SystemInput>) =>
      apiFetch<AiSystem>(`/systems/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["systems", id] });
    },
  });
}

// Best-effort cleanup for a freshly-started intake draft the user leaves
// without typing anything — plain fetch (not a mutation hook) so it can run
// from a component's unmount cleanup. The server no-ops silently if the
// draft was actually touched, so there's nothing to await or handle here.
export function abandonSystem(id: string) {
  // keepalive lets this survive a hard navigation/tab-close, not just an
  // in-app route change, since the request would otherwise be cancelled
  // when the page starts unloading.
  return apiFetch(`/systems/${id}/abandon`, { method: "POST", keepalive: true }).catch(() => {});
}

export function useCompleteIntake(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<AiSystem>(`/systems/${id}/complete-intake`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["systems", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/systems/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "activity"] });
      removeRecentlyViewed(id);
    },
  });
}

export function useUpdateSystemStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: SystemStatus) =>
      apiFetch<AiSystem>(`/systems/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["systems", id] });
    },
  });
}

export interface BulkUpdateInput {
  ids: string[];
  ownerId?: string;
  status?: SystemStatus;
  businessUnit?: string;
}

export function useBulkUpdateSystems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkUpdateInput) =>
      apiFetch<{ updated: number }>("/systems/bulk", { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "activity"] });
    },
  });
}

export function useBulkDeleteSystems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ deleted: number }>("/systems/bulk", { method: "DELETE", body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["systems"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "activity"] });
    },
  });
}
