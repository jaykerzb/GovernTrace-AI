import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Comment } from "./types";

export function useComments(systemId: string | undefined) {
  return useQuery({
    queryKey: ["systems", systemId, "comments"],
    queryFn: () => apiFetch<Comment[]>(`/systems/${systemId}/comments`),
    enabled: !!systemId,
  });
}

export function useCreateComment(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<Comment>(`/systems/${systemId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["systems", systemId, "comments"] }),
  });
}

export function useUpdateComment(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiFetch<Comment>(`/comments/${id}`, { method: "PATCH", body: JSON.stringify({ body }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["systems", systemId, "comments"] }),
  });
}

export function useDeleteComment(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/comments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["systems", systemId, "comments"] }),
  });
}
