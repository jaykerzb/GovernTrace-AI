import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useCalendarEvents } from "../api/calendar";
import { useCreateMeeting, useDeleteMeeting } from "../api/meetings";
import { useSystems } from "../api/systems";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { ApiError } from "../api/client";
import type { CalendarEvent, CalendarEventType } from "../api/types";

const EVENT_COLORS: Record<CalendarEventType, string> = {
  MEETING: "#6366f1",
  REASSESSMENT: "#f59e0b",
  DEPLOYMENT: "#8b5cf6",
};

const EVENT_LABELS: Record<CalendarEventType, string> = {
  MEETING: "Meeting",
  REASSESSMENT: "Re-Assessment Due",
  DEPLOYMENT: "Target Deployment",
};

const inputClass =
  "w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none";

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthGridDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
}

export function CalendarPage() {
  const { user } = useAuth();
  const { has } = usePermissions();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [description, setDescription] = useState("");
  const [aiSystemId, setAiSystemId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rangeFrom = useMemo(() => new Date(viewYear, viewMonth - 1, 1), [viewYear, viewMonth]);
  const rangeTo = useMemo(() => new Date(viewYear, viewMonth + 2, 0), [viewYear, viewMonth]);
  const { data: events, isLoading } = useCalendarEvents(rangeFrom, rangeTo);
  const { data: systems } = useSystems();
  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events ?? []) {
      const key = dateKey(new Date(e.date));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const days = monthGridDays(viewYear, viewMonth);
  const selectedKey = dateKey(selectedDay);
  const selectedEvents = (eventsByDay.get(selectedKey) ?? []).sort((a, b) => a.date.localeCompare(b.date));

  function goToMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function openNewMeetingForm(day: Date) {
    setSelectedDay(day);
    setTitle("");
    setTime("09:00");
    setDescription("");
    setAiSystemId("");
    setError(null);
    setShowForm(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), hours || 0, minutes || 0);
    try {
      await createMeeting.mutateAsync({
        title,
        description: description || null,
        date: date.toISOString(),
        aiSystemId: aiSystemId || null,
      });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not schedule this meeting.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteMeeting.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this meeting.");
    }
  }

  const canSchedule = !!user && has("SCHEDULE_MEETING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Scheduled meetings, re-assessment due dates, and target deployments.</p>
        </div>
        {canSchedule && (
          <button
            onClick={() => openNewMeetingForm(selectedDay)}
            className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600"
          >
            + New Meeting
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        {(Object.keys(EVENT_LABELS) as CalendarEventType[]).map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EVENT_COLORS[type] }} />
            {EVENT_LABELS[type]}
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => goToMonth(-1)}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            &larr; Prev
          </button>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <button
            onClick={() => goToMonth(1)}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Next &rarr;
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="pb-1 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDay.get(key) ?? [];
              const inMonth = day.getMonth() === viewMonth;
              const isToday = key === dateKey(today);
              const isSelected = key === selectedKey;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDay(day);
                    setShowForm(false);
                  }}
                  className={`flex h-16 flex-col items-start rounded-md border p-1.5 text-left transition-colors ${
                    isSelected
                      ? "border-slate-900 dark:border-slate-100"
                      : "border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  } ${inMonth ? "" : "opacity-40"}`}
                >
                  <span
                    className={`text-xs ${
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 4).map((e) => (
                      <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: EVENT_COLORS[e.type] }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h2>
          {canSchedule && !showForm && (
            <button onClick={() => openNewMeetingForm(selectedDay)} className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">
              + Schedule a meeting this day
            </button>
          )}
        </div>

        {selectedEvents.length === 0 && !showForm && (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nothing scheduled this day.</p>
        )}

        {selectedEvents.length > 0 && (
          <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-800">
            {selectedEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: EVENT_COLORS[e.type] }} />
                  <div className="min-w-0">
                    {e.link ? (
                      <Link to={e.link} className="truncate text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline">
                        {e.title}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{e.title}</span>
                    )}
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {new Date(e.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} &middot; {EVENT_LABELS[e.type]}
                    </div>
                  </div>
                </div>
                {e.type === "MEETING" && canSchedule && (
                  <button
                    onClick={() => handleDelete(e.id.replace("meeting-", ""))}
                    disabled={deleteMeeting.isPending}
                    className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Title</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. AI Governance Committee Sync" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Linked AI Use Case (optional)</label>
              <select value={aiSystemId} onChange={(e) => setAiSystemId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {systems?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Description (optional)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={2} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createMeeting.isPending}
                className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                {createMeeting.isPending ? "Scheduling..." : "Schedule Meeting"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:underline">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
