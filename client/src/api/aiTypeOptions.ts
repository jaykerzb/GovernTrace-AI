import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface AiTypeOption {
  id: string;
  key: string;
  label: string;
  definition: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

// Every option, including inactive ones — dropdowns filter to active
// themselves; label lookups need the full set so a system using a
// since-deactivated type still shows a real label instead of its raw key.
export function useAiTypeOptions() {
  return useQuery({
    queryKey: ["ai-type-options"],
    queryFn: () => apiFetch<AiTypeOption[]>("/ai-type-options"),
    staleTime: 60_000,
  });
}

export function useActiveAiTypeOptions() {
  const { data, ...rest } = useAiTypeOptions();
  return { ...rest, data: data?.filter((o) => o.isActive) };
}

export function useAiTypeLabel() {
  const { data } = useAiTypeOptions();
  const byKey = new Map((data ?? []).map((o) => [o.key, o.label]));
  return (key: string) => byKey.get(key) ?? key;
}

export function useCreateAiTypeOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ label, definition }: { label: string; definition?: string }) =>
      apiFetch<AiTypeOption>("/admin/ai-type-options", { method: "POST", body: JSON.stringify({ label, definition }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-type-options"] });
      qc.invalidateQueries({ queryKey: ["admin", "ai-type-options"] });
    },
  });
}

export function useUpdateAiTypeOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...update }: { id: string; label?: string; definition?: string | null; isActive?: boolean; sortOrder?: number }) =>
      apiFetch<AiTypeOption>(`/admin/ai-type-options/${id}`, { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-type-options"] });
      qc.invalidateQueries({ queryKey: ["admin", "ai-type-options"] });
    },
  });
}

export function useDeleteAiTypeOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/ai-type-options/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-type-options"] });
      qc.invalidateQueries({ queryKey: ["admin", "ai-type-options"] });
    },
  });
}
