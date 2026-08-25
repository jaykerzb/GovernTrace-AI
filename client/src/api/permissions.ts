import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Role } from "./types";

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

// The current user's own effective privileges, sourced live from the server
// (see server/src/routes/permissions.ts) rather than a static role→action
// map, so an admin's edit in the Roles tab takes effect without a re-login.
export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => apiFetch<{ permissions: string[] }>("/my-permissions"),
    staleTime: 30_000,
  });
  const set = new Set(data?.permissions ?? []);
  return { has: (key: string) => set.has(key), isLoading };
}

export function useRolePermissions() {
  return useQuery({
    queryKey: ["admin", "role-permissions"],
    queryFn: () => apiFetch<{ permissions: PermissionDef[]; grants: Record<Role, string[]> }>("/admin/role-permissions"),
  });
}

export function useSetRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ role, permission, granted }: { role: Role; permission: string; granted: boolean }) =>
      apiFetch<void>("/admin/role-permissions", { method: "PATCH", body: JSON.stringify({ role, permission, granted }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "role-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    },
  });
}
