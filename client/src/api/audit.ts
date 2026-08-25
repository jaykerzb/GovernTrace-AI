import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { AuditLogEntry } from "./types";

export function useAuditLog(systemId: string | undefined) {
  return useQuery({
    queryKey: ["systems", systemId, "audit"],
    queryFn: () => apiFetch<AuditLogEntry[]>(`/systems/${systemId}/audit`),
    enabled: !!systemId,
  });
}
