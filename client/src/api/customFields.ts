import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export type CustomFieldType = "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT";

export interface CustomFieldDef {
  id: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options: string | null; // JSON array string, only for SELECT
  required: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export function useCustomFieldDefs() {
  return useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => apiFetch<CustomFieldDef[]>("/custom-fields"),
    staleTime: 60_000,
  });
}

export function useActiveCustomFieldDefs() {
  const { data, ...rest } = useCustomFieldDefs();
  return { ...rest, data: data?.filter((f) => f.isActive) };
}

export interface CreateCustomFieldInput {
  label: string;
  fieldType: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomFieldInput) =>
      apiFetch<CustomFieldDef>("/admin/custom-fields", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-fields"] }),
  });
}

export interface UpdateCustomFieldInput {
  id: string;
  label?: string;
  options?: string[];
  required?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...update }: UpdateCustomFieldInput) =>
      apiFetch<CustomFieldDef>(`/admin/custom-fields/${id}`, { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-fields"] }),
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/custom-fields/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-fields"] }),
  });
}
