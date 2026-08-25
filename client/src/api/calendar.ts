import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { CalendarEvent } from "./types";

export function useCalendarEvents(from?: Date, to?: Date) {
  const params = new URLSearchParams();
  if (from) params.set("from", from.toISOString());
  if (to) params.set("to", to.toISOString());
  const qs = params.toString();
  return useQuery({
    queryKey: ["calendar-events", from?.toISOString(), to?.toISOString()],
    queryFn: () => apiFetch<CalendarEvent[]>(`/calendar-events${qs ? `?${qs}` : ""}`),
  });
}
