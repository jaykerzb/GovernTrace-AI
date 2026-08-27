import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface MyQueueData {
  draftIntakes: { id: string; name: string; status: string; updatedAt: string }[];
  draftAssessments: { id: string; version: number; aiSystemId: string; aiSystemName: string }[];
  openWorkPapers: { id: string; functionKey: string; status: string; aiSystemId: string; aiSystemName: string }[];
  readyCommitteeReviews: { id: string; aiSystemId: string; finalDisposition: string; aiSystemName: string }[];
  dueForReassessment: { id: string; name: string; nextReviewDue: string }[];
}

// See useDashboard's comment — same shared-query/per-caller-interval
// pattern, since SidebarQuickStats also renders this on every page.
export function useMyQueue(intervalMs = 15000) {
  return useQuery({
    queryKey: ["my-queue"],
    queryFn: () => apiFetch<MyQueueData>("/my-queue"),
    refetchInterval: intervalMs,
  });
}
