import { useClassificationOptions } from "../../api/assessments";
import type { Triggers } from "../../api/reviewFunctions";

function idNumber(id: string): number {
  return parseInt(id.slice(1), 10);
}

function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: number; label: string }[];
  selected: number[];
  onChange: (next: number[]) => void;
}) {
  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            title={o.label}
            className={`rounded-md border px-2 py-1 text-xs font-medium ${
              selected.includes(o.id)
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Empty selection on a dimension means "wildcard" (matches every value on
// that dimension) — same semantics the scoping logic uses everywhere else.
export function TriggerEditor({ value, onChange }: { value: Triggers; onChange: (next: Triggers) => void }) {
  const { data: options } = useClassificationOptions();

  const deliveryModelOptions = (options?.deliveryModels ?? []).map((o) => ({ id: idNumber(o.id), label: o.id }));
  const capabilityTierOptions = (options?.capabilityTiers ?? []).map((o) => ({ id: idNumber(o.id), label: o.id }));
  const riskFactorOptions = (options?.riskFactors ?? []).map((o) => ({ id: o.id, label: `RF${o.id}` }));

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Leave a row blank to match every value on that dimension. Any Risk Factor selected also brings this into scope
        regardless of Delivery Model / Capability Tier.
      </p>
      <CheckboxGroup
        label="Delivery Models"
        options={deliveryModelOptions}
        selected={value.deliveryModels}
        onChange={(deliveryModels) => onChange({ ...value, deliveryModels })}
      />
      <CheckboxGroup
        label="Capability Tiers"
        options={capabilityTierOptions}
        selected={value.capabilityTiers}
        onChange={(capabilityTiers) => onChange({ ...value, capabilityTiers })}
      />
      <CheckboxGroup
        label="Risk Factors"
        options={riskFactorOptions}
        selected={value.riskFactors}
        onChange={(riskFactors) => onChange({ ...value, riskFactors })}
      />
    </div>
  );
}
