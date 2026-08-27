import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "./client";

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

export type UpdateProgressEvent =
  | { type: "step-start"; command: string }
  | { type: "step-output"; chunk: string }
  | { type: "step-done"; command: string }
  | { type: "step-failed"; command: string; error: string };

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

// Not a useMutation — the response is a Server-Sent Events stream (see
// server/src/routes/system.ts), not a single JSON body, so it needs manual
// fetch + stream reading to call onEvent as each line of build/migration
// output arrives instead of only finding out once everything's done.
export async function installUpdateStreaming(onEvent: (event: UpdateProgressEvent) => void): Promise<UpdateInstallResult> {
  const res = await fetch("/api/admin/system/updates/install", { method: "POST", credentials: "include" });
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, res.statusText || "Could not start the update.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; each starts with "data: ".
    let frameEnd: number;
    while ((frameEnd = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice("data: ".length));
      if (payload.type === "done") return payload.result as UpdateInstallResult;
      onEvent(payload as UpdateProgressEvent);
    }
  }

  throw new ApiError(500, "Update stream ended unexpectedly.");
}

export function useUpdateNetworkSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: NetworkSettingsUpdate) =>
      apiFetch<{ success: boolean }>("/admin/system/network", { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-status"] }),
  });
}
