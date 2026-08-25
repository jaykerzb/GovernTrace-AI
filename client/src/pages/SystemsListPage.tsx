import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSystems, useBulkUpdateSystems, useBulkDeleteSystems } from "../api/systems";
import { useActiveAiTypeOptions, useAiTypeLabel } from "../api/aiTypeOptions";
import { useUsers } from "../api/users";
import { RiskScoreBadge, StatusBadge, STATUS_LABELS } from "../components/Badges";
import { ArrowUpIcon, ArrowDownIcon } from "../components/Icons";
import { NotesCell } from "../components/NotesCell";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { useOrgSettings } from "../api/orgSettings";
import { downloadCsv } from "../lib/csv";
import { riskBand } from "../lib/riskBand";
import { RISK_LABELS } from "../constants/riskColors";
import { ApiError } from "../api/client";
import type { AiSystem, SystemStatus } from "../api/types";

type SortKey = "name" | "businessUnit" | "aiType" | "status" | "riskScore" | "createdAt";
type SortDirection = "asc" | "desc";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "businessUnit", label: "Business Unit" },
  { key: "aiType", label: "AI Type" },
  { key: "status", label: "Status" },
  { key: "riskScore", label: "Risk Score" },
  { key: "createdAt", label: "Created" },
];

function sortValue(s: AiSystem, key: SortKey): string | number {
  switch (key) {
    case "name":
      return s.name.toLowerCase();
    case "businessUnit":
      return s.businessUnit.toLowerCase();
    case "aiType":
      return s.aiType;
    case "status":
      return s.status;
    case "riskScore":
      return s.currentScore ?? -1;
    case "createdAt":
      return new Date(s.createdAt).getTime();
  }
}

const STATUS_OPTIONS: SystemStatus[] = ["DRAFT", "INTAKE", "RISK_ASSESSMENT", "UNDER_REVIEW", "APPROVED", "DEPLOYED", "MONITORING", "RETIRED"];

const selectClass = "rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none";

export function SystemsListPage() {
  const { user } = useAuth();
  const { has } = usePermissions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [aiType, setAiType] = useState("");
  const [businessUnit, setBusinessUnit] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOwnerId, setBulkOwnerId] = useState("");
  const [bulkStatus, setBulkStatus] = useState<SystemStatus | "">("");
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const isAdmin = has("BULK_MANAGE_SYSTEMS");
  const bulkUpdate = useBulkUpdateSystems();
  const bulkDelete = useBulkDeleteSystems();
  const { data: users } = useUsers();

  const { data: aiTypeOptions } = useActiveAiTypeOptions();
  const aiTypeLabel = useAiTypeLabel();
  const { data: orgSettings } = useOrgSettings();
  const riskThresholds = {
    riskBandLowMax: orgSettings?.riskBandLowMax ?? 15,
    riskBandModerateMax: orgSettings?.riskBandModerateMax ?? 30,
    riskBandHighMax: orgSettings?.riskBandHighMax ?? 38,
  };
  const { data: systemsData, isLoading } = useSystems({
    q: q || undefined,
    status: status || undefined,
    aiType: aiType || undefined,
    businessUnit: businessUnit || undefined,
  });

  const systems = useMemo(() => {
    if (!systemsData) return systemsData;
    const sign = sortDirection === "asc" ? 1 : -1;
    return [...systemsData].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });
  }, [systemsData, sortKey, sortDirection]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Time-based columns default to newest-first; text columns default to A-Z.
      setSortDirection(key === "createdAt" ? "desc" : "asc");
    }
  }

  const hasFilters = !!(q || status || aiType || businessUnit);

  function clearFilters() {
    setQ("");
    setStatus("");
    setAiType("");
    setBusinessUnit("");
  }

  function exportCsv() {
    downloadCsv(
      `ai-use-case-registry-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Business Unit", "AI Type", "Status", "Risk Score", "Flagged for Review", "Created", "Notes"],
      (systems ?? []).map((s) => [
        s.name,
        s.businessUnit,
        aiTypeLabel(s.aiType),
        STATUS_LABELS[s.status],
        s.currentScore !== null ? `${RISK_LABELS[riskBand(s.currentScore, riskThresholds)]} (${s.currentScore})` : "Not Assessed",
        s.currentReviewTriggered ? "Yes" : "No",
        new Date(s.createdAt).toLocaleDateString(),
        s.notes ?? "",
      ])
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!systems) return;
    setSelectedIds((prev) => (prev.size === systems.length ? new Set() : new Set(systems.map((s) => s.id))));
  }

  function exportSelectedCsv() {
    const selected = (systems ?? []).filter((s) => selectedIds.has(s.id));
    downloadCsv(
      `ai-use-case-registry-selected-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Business Unit", "AI Type", "Status", "Risk Score", "Flagged for Review", "Created", "Notes"],
      selected.map((s) => [
        s.name,
        s.businessUnit,
        aiTypeLabel(s.aiType),
        STATUS_LABELS[s.status],
        s.currentScore !== null ? `${RISK_LABELS[riskBand(s.currentScore, riskThresholds)]} (${s.currentScore})` : "Not Assessed",
        s.currentReviewTriggered ? "Yes" : "No",
        new Date(s.createdAt).toLocaleDateString(),
        s.notes ?? "",
      ])
    );
  }

  async function handleBulkApply() {
    setBulkError(null);
    if (!bulkOwnerId && !bulkStatus) {
      setBulkError("Choose an owner or a status to apply.");
      return;
    }
    try {
      await bulkUpdate.mutateAsync({
        ids: Array.from(selectedIds),
        ownerId: bulkOwnerId || undefined,
        status: bulkStatus || undefined,
      });
      setSelectedIds(new Set());
      setBulkOwnerId("");
      setBulkStatus("");
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Could not apply this bulk update.");
    }
  }

  async function handleBulkDelete() {
    setBulkError(null);
    try {
      await bulkDelete.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      setConfirmingBulkDelete(false);
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Could not delete these AI use cases.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">AI Use Case Registry</h1>
        <button
          onClick={exportCsv}
          disabled={!systems || systems.length === 0}
          className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by Name..."
          className="w-56 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
        />
        <input
          value={businessUnit}
          onChange={(e) => setBusinessUnit(e.target.value)}
          placeholder="Business Unit..."
          className="w-44 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select value={aiType} onChange={(e) => setAiType(e.target.value)} className={selectClass}>
          <option value="">All AI Types</option>
          {aiTypeOptions?.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm font-medium text-slate-500 dark:text-slate-400 underline decoration-dotted hover:text-slate-700 dark:hover:text-slate-300">
            Clear Filters
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950 px-4 py-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedIds.size} selected</span>
          <button
            onClick={exportSelectedCsv}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            Export CSV
          </button>
          <Link
            to={`/systems/export-bulk?ids=${Array.from(selectedIds).join(",")}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            Export PDF
          </Link>
          {isAdmin && (
            <>
              <select value={bulkOwnerId} onChange={(e) => setBulkOwnerId(e.target.value)} className={selectClass}>
                <option value="">Reassign owner...</option>
                {users?.filter((u) => u.isActive !== false).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as SystemStatus | "")}
                className={selectClass}
              >
                <option value="">Change status...</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkApply}
                disabled={bulkUpdate.isPending || (!bulkOwnerId && !bulkStatus)}
                className="rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                {bulkUpdate.isPending ? "Applying..." : "Apply"}
              </button>
              <div className="ml-auto flex items-center gap-2">
                {confirmingBulkDelete ? (
                  <>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDelete.isPending}
                      className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                    >
                      {bulkDelete.isPending ? "Deleting..." : `Confirm delete ${selectedIds.size}`}
                    </button>
                    <button
                      onClick={() => setConfirmingBulkDelete(false)}
                      className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmingBulkDelete(true)}
                    className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Delete Selected
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {bulkError && <p className="text-sm text-red-600">{bulkError}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full min-w-[68rem] text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={!!systems && systems.length > 0 && selectedIds.size === systems.length}
                  onChange={toggleSelectAll}
                />
              </th>
              {SORT_COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3">
                  <button
                    onClick={() => toggleSort(col.key)}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {col.label}
                    {sortKey === col.key &&
                      (sortDirection === "asc" ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && systems?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  No AI use cases match your filters.
                </td>
              </tr>
            )}
            {systems?.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-950">
                <td className="px-4 py-3 align-top">
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                </td>
                <td className="px-4 py-3 align-top">
                  <Link to={`/systems/${s.id}`} className="font-medium text-slate-800 dark:text-slate-200 hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-400">{s.businessUnit}</td>
                <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-400">{aiTypeLabel(s.aiType)}</td>
                <td className="px-4 py-3 align-top">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 align-top">
                  <RiskScoreBadge score={s.currentScore} />
                </td>
                <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                <td className="px-1 py-1.5 align-top">
                  <NotesCell
                    id={s.id}
                    notes={s.notes}
                    editable={!!user && has("EDIT_SYSTEM") && (user.role !== "SYSTEM_OWNER" || user.id === s.ownerId)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
