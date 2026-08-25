import type { ApprovalAuthority } from "@prisma/client";
import type { Question } from "./riskQuestions.js";

export const AISC_THRESHOLD = 30;

// `threshold` defaults to AISC_THRESHOLD but callers should pass the org's
// configured approvalThreshold (see services/orgSettings.ts) so this stays
// consistent with whatever the org has customized it to.
export function scoreToApprovalAuthority(score: number, threshold: number = AISC_THRESHOLD): ApprovalAuthority {
  return score > threshold ? "AISC" : "AIGA";
}

// --- Classification: Delivery Model, Capability Tier, Risk Factors ----------

export interface ClassificationOption {
  id: string;
  label: string;
}

export const DELIVERY_MODELS: ClassificationOption[] = [
  { id: "D1", label: "D1 — Existing Vendor Feature Activation" },
  { id: "D2", label: "D2 — Existing Vendor Model Upgrade" },
  { id: "D3", label: "D3 — New Vendor / Tool" },
  { id: "D4", label: "D4 — Internally Developed / Custom" },
];

export const CAPABILITY_TIERS: ClassificationOption[] = [
  { id: "T1", label: "T1 — Assistive / Query-Based" },
  { id: "T2", label: "T2 — Embedded / Workflow-Integrated" },
  { id: "T3", label: "T3 — Data-Retrieving / RAG" },
  { id: "T4", label: "T4 — Autonomous / Agentic" },
];

export interface RiskFactor {
  id: number;
  label: string;
  description: string;
}

export const RISK_FACTORS: RiskFactor[] = [
  { id: 1, label: "PII / NPI / PCI", description: "AI processes personally identifiable information, nonpublic personal information, or payment card data." },
  { id: 2, label: "Customer-Facing", description: "AI directly interacts with customers or its outputs are visible to customers." },
  { id: 3, label: "Internal Systems Access", description: "AI has elevated access to internal systems, databases, or core infrastructure." },
  { id: 4, label: "Vendor Training Data Use", description: "Vendor uses organizational data for training or fine-tuning." },
  { id: 5, label: "Agentic Actions", description: "AI takes autonomous actions on behalf of the organization (writes data, calls APIs, executes transactions)." },
  { id: 6, label: "Vendor Data Processing", description: "Organizational data is processed in vendor environments." },
  { id: 7, label: "External API", description: "AI calls external APIs or third-party services beyond the immediate vendor." },
  { id: 8, label: "Code Generation/Execution", description: "AI generates code or executes code." },
  { id: 9, label: "Persistent Memory", description: "AI maintains persistent memory or context across sessions." },
  { id: 10, label: "Regulatory-Sensitive", description: "AI is used in BSA/AML, fraud, sanctions/OFAC, fair lending, credit decisioning, or other regulatory-sensitive contexts." },
];

// Suggests a Capability Tier from Dimension 2's Decision Autonomy answer
// (and Dimension 1's full-autonomy gate, which forces T4). Returns null if
// there isn't enough information yet, or if the org has since removed/renamed
// the questions these gates key off of.
export function suggestCapabilityTier(answers: Record<string, string>, dimension2Questions: Question[]): string | null {
  if (answers["d1_full_autonomy"] === "Yes") return "T4";

  const q = dimension2Questions.find((d) => d.id === "d2_decision_autonomy");
  if (!q) return null;
  const chosen = q.options.findIndex((o) => o.label === answers["d2_decision_autonomy"]);
  if (chosen === 0) return "T1"; // Assistive/informational only
  if (chosen === 1) return "T3"; // Human on the loop (assume RAG-style)
  if (chosen === 2) return "T4"; // Fully automated
  return null;
}

// Suggests Risk Factors from Dimension 1 and Dimension 2 answers. Additive
// only — callers should union this with any manually-added factors. Silently
// skips any gate whose underlying question the org has since removed.
export function suggestRiskFactors(answers: Record<string, string>, dimension2Questions: Question[]): number[] {
  const suggested = new Set<number>();
  if (answers["d1_customer_facing"] === "Yes") suggested.add(2);
  if (answers["d1_regulated_decisions"] === "Yes") suggested.add(10);
  if (answers["d1_vendor_training_data"] === "Yes") suggested.add(4);
  if (answers["d1_full_autonomy"] === "Yes") suggested.add(5);

  const highestOptionChosen = (questionId: string) => {
    const q = dimension2Questions.find((d) => d.id === questionId);
    if (!q || q.options.length === 0) return false;
    return q.options[q.options.length - 1].label === answers[questionId];
  };
  if (highestOptionChosen("d2_data_sensitivity")) suggested.add(1);
  if (highestOptionChosen("d2_external_interaction")) suggested.add(2);
  if (highestOptionChosen("d2_business_impact")) suggested.add(10);

  return Array.from(suggested).sort((a, b) => a - b);
}
