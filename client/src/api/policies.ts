import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Policy, PolicyCategory } from "./types";

export interface PolicyFilters {
  category?: string;
  q?: string;
}

export function usePolicies(filters: PolicyFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const qs = params.toString();
  return useQuery({
    queryKey: ["policies", filters],
    queryFn: () => apiFetch<Policy[]>(`/policies${qs ? `?${qs}` : ""}`),
  });
}

export interface CreatePolicyInput {
  file: File;
  title: string;
  category: PolicyCategory;
  description?: string;
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePolicyInput) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("title", input.title);
      form.append("category", input.category);
      if (input.description) form.append("description", input.description);
      return apiFetch<Policy>("/policies", { method: "POST", body: form });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policies"] }),
  });
}

export interface UpdatePolicyInput {
  id: string;
  title?: string;
  description?: string | null;
  category?: PolicyCategory;
  isActive?: boolean;
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...update }: UpdatePolicyInput) =>
      apiFetch<Policy>(`/policies/${id}`, { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policies"] }),
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/policies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policies"] }),
  });
}
