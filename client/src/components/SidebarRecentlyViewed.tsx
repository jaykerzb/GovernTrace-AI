import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { pruneRecentlyViewed, useRecentlyViewed } from "../hooks/useRecentlyViewed";

export function SidebarRecentlyViewed() {
  const entries = useRecentlyViewed();
  const location = useLocation();

  useEffect(() => {
    pruneRecentlyViewed();
    // Runs once on mount — the sidebar persists for the whole session, so
    // this catches deletions from elsewhere without needing to re-check on
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="mt-4 px-2">
      <div className="mb-1 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Recently Viewed</span>
      </div>
      <div className="space-y-0.5">
        {entries.map((entry) => {
          const active = location.pathname === `/systems/${entry.id}`;
          return (
            <Link
              key={entry.id}
              to={`/systems/${entry.id}`}
              title={entry.name}
              className={`block truncate rounded-md px-2 py-1.5 text-xs ${
                active
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {entry.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
