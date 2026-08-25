import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { AuditLogEntry, Role, User } from "./types";

// --- Users -------------------------------------------------------------

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<User[]>("/admin/users"),
  });
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  password: string;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => apiFetch<User>("/admin/users", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      apiFetch<User>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["admin", "activity"] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      apiFetch<void>(`/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),
  });
}

// --- System-level activity -------------------------------------------------

export function useAdminActivity() {
  return useQuery({
    queryKey: ["admin", "activity"],
    queryFn: () => apiFetch<AuditLogEntry[]>("/admin/activity"),
  });
}
