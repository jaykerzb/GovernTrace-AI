import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Meeting } from "./types";

export function useMeetings(from?: Date, to?: Date) {
  const params = new URLSearchParams();
  if (from) params.set("from", from.toISOString());
  if (to) params.set("to", to.toISOString());
  const qs = params.toString();
  return useQuery({
    queryKey: ["meetings", from?.toISOString(), to?.toISOString()],
    queryFn: () => apiFetch<Meeting[]>(`/meetings${qs ? `?${qs}` : ""}`),
  });
}

export interface MeetingInput {
  title: string;
  description?: string | null;
  date: string;
  aiSystemId?: string | null;
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["meetings"] });
  qc.invalidateQueries({ queryKey: ["calendar-events"] });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MeetingInput) => apiFetch<Meeting>("/meetings", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMeeting(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<MeetingInput>) =>
      apiFetch<Meeting>(`/meetings/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}
