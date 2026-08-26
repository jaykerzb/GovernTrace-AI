import { Link, useParams } from "react-router-dom";
import { useSystem } from "../api/systems";
import { SystemExportCard } from "../components/SystemExportCard";
import { primaryButtonBase } from "../lib/ui";

export function SystemExportPage() {
  const { id } = useParams();
  const { data: system } = useSystem(id);

  if (!id || !system) {
    return <p className="text-slate-500 dark:text-slate-400">Loading export...</p>;
  }

  return (
    <div className="max-w-3xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex items-start justify-between print:hidden">
        <Link to={`/systems/${id}`} className="text-xs text-slate-400 hover:underline dark:text-slate-500">
          &larr; Back to {system.name}
        </Link>
        <button
          onClick={() => window.print()}
          className={`${primaryButtonBase} px-4 py-2 text-sm`}
        >
          Print / Save as PDF
        </button>
      </div>

      <SystemExportCard systemId={id} />
    </div>
  );
}
