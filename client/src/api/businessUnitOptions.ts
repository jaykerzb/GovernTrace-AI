import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface BusinessUnitOption {
  id: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

// Every option, including inactive ones — pickers filter to active
// themselves; other views need the full set so a system using a
// since-deactivated business unit still shows a real label.
export function useBusinessUnitOptions() {
  return useQuery({
    queryKey: ["business-unit-options"],
    queryFn: () => apiFetch<BusinessUnitOption[]>("/business-unit-options"),
    staleTime: 60_000,
  });
}

export function useActiveBusinessUnitOptions() {
  const { data, ...rest } = useBusinessUnitOptions();
  return { ...rest, data: data?.filter((o) => o.isActive) };
}

export function useCreateBusinessUnitOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label: string) =>
      apiFetch<BusinessUnitOption>("/admin/business-unit-options", { method: "POST", body: JSON.stringify({ label }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-unit-options"] });
      qc.invalidateQueries({ queryKey: ["admin", "business-unit-options"] });
    },
  });
}

export function useUpdateBusinessUnitOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...update }: { id: string; isActive?: boolean; sortOrder?: number }) =>
      apiFetch<BusinessUnitOption>(`/admin/business-unit-options/${id}`, { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-unit-options"] });
      qc.invalidateQueries({ queryKey: ["admin", "business-unit-options"] });
    },
  });
}

export function useDeleteBusinessUnitOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/business-unit-options/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-unit-options"] });
      qc.invalidateQueries({ queryKey: ["admin", "business-unit-options"] });
    },
  });
}
