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

export interface DemoDataResult {
  success: boolean;
  output: string;
  error?: string;
}

export type DemoDataProgressEvent = { type: "output"; chunk: string };

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

// Shared by every admin/system endpoint that streams Server-Sent Events
// instead of a single JSON body (see server/src/routes/system.ts) — each
// sends progress events as they happen and a final `{type: "done", result}`
// frame, so the caller finds out about each step instead of only learning
// the outcome once everything's finished.
async function streamSse<TEvent, TResult>(url: string, onEvent: (event: TEvent) => void): Promise<TResult> {
  const res = await fetch(url, { method: "POST", credentials: "include" });
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, res.statusText || "Could not start.");
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
      if (payload.type === "done") return payload.result as TResult;
      onEvent(payload as TEvent);
    }
  }

  throw new ApiError(500, "Stream ended unexpectedly.");
}

export function installUpdateStreaming(onEvent: (event: UpdateProgressEvent) => void): Promise<UpdateInstallResult> {
  return streamSse("/api/admin/system/updates/install", onEvent);
}

export function seedDemoDataStreaming(onEvent: (event: DemoDataProgressEvent) => void): Promise<DemoDataResult> {
  return streamSse("/api/admin/system/demo-data/seed", onEvent);
}

export function removeDemoDataStreaming(onEvent: (event: DemoDataProgressEvent) => void): Promise<DemoDataResult> {
  return streamSse("/api/admin/system/demo-data/remove", onEvent);
}

export function useUpdateNetworkSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: NetworkSettingsUpdate) =>
      apiFetch<{ success: boolean }>("/admin/system/network", { method: "PATCH", body: JSON.stringify(update) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-status"] }),
  });
}
