import { useAdminActivity } from "../../api/admin";
import { AuditLogPanel } from "../AuditLogPanel";

export function AdminActivityPanel() {
  const { data: logs, isLoading } = useAdminActivity();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        System-level actions — user management changes — that aren't tied to a specific AI use case. Per-system
        activity lives on each use case's own page.
      </p>

      {isLoading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading activity...</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <AuditLogPanel logs={logs} emptyMessage="No system-level activity yet." />
        </div>
      )}
    </div>
  );
}
