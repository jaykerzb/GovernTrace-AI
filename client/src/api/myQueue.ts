import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface MyQueueData {
  draftIntakes: { id: string; name: string; status: string; updatedAt: string }[];
  draftAssessments: { id: string; version: number; aiSystemId: string; aiSystemName: string }[];
  openWorkPapers: { id: string; functionKey: string; status: string; aiSystemId: string; aiSystemName: string }[];
  readyCommitteeReviews: { id: string; aiSystemId: string; finalDisposition: string; aiSystemName: string }[];
  dueForReassessment: { id: string; name: string; nextReviewDue: string }[];
}

export function useMyQueue() {
  return useQuery({
    queryKey: ["my-queue"],
    queryFn: () => apiFetch<MyQueueData>("/my-queue"),
    refetchInterval: 15000,
  });
}
