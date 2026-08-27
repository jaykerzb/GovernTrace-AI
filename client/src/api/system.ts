import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface SystemStatus {
  commit: { sha: string; message: string };
  network: { port: number | null; clientOrigin: string; cookieSecure: boolean };
}

export interface PendingCommit {
  sha: string;
  message: string;
}

export interface UpdateCheckResult {
  upToDate: boolean;
  commits: PendingCommit[];
}

export interface UpdateInstallResult {
  success: boolean;
  steps: { command: string; output: string }[];
  error?: string;
}

export interface NetworkSettingsUpdate {
  port?: number;
  clientOrigin?: string;
  cookieSecure?: boolean;
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: () => apiFetch<SystemStatus>("/admin/system/status"),
  });
}

export function useCheckForUpdates() {
  return useMutation({
    mutationFn: () => apiFetch<UpdateCheckResult>("/admin/system/updates"),
  });
}

export function useInstallUpdate() {
  return useMutation({
    mutationFn: () => apiFetch<UpdateInstallResult>("/admin/system/updates/install", { method: "POST" }),
  });
}

export function useUpdateNetworkSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: NetworkSettingsUpdate) =>
      apiFetch<{ success: boolean }>("/admin/system/network", { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-status"] }),
  });
}
