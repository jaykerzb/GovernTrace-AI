import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { CalendarEvent } from "./types";

export function useCalendarEvents(from?: Date, to?: Date) {
  const params = new URLSearchParams();
  if (from) params.set("from", from.toISOString());
  if (to) params.set("to", to.toISOString());
  const qs = params.toString();
  return useQuery({
    // Truncated to whole days, not the full millisecond-precision ISO
    // string — a date *range* doesn't need finer granularity than that, and
    // keying on the full timestamp means any caller that passes an
    // unmemoized `new Date()` (a fresh value, and a fresh cache key, on
    // every render) turns into an infinite fetch loop: each fetch
    // completing triggers a re-render, which creates a new Date, which
    // fires another fetch. Day-level keys make that class of bug harmless
    // even if a future caller repeats the mistake.
    queryKey: ["calendar-events", from?.toISOString().slice(0, 10), to?.toISOString().slice(0, 10)],
    queryFn: () => apiFetch<CalendarEvent[]>(`/calendar-events${qs ? `?${qs}` : ""}`),
  });
}
