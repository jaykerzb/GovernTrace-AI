import { prisma } from "../lib/prisma.js";
import { REVIEW_FUNCTIONS } from "./workPaperQuestions.js";
import type {
  ReviewFunctionDef as ReviewFunctionDefRow,
  WorkPaperSectionDef as WorkPaperSectionDefRow,
  WorkPaperQuestionDef as WorkPaperQuestionDefRow,
} from "@prisma/client";

export interface Triggers {
  deliveryModels: number[];
  capabilityTiers: number[];
  riskFactors: number[];
}

export interface WireQuestion {
  id: string; // WorkPaperQuestionDef.key
  text: string;
  citation: string;
  isActive: boolean;
}

export interface WireSection {
  id: string; // WorkPaperSectionDef.key
  title: string;
  triggerLabel: string;
  triggers: Triggers;
  isActive: boolean;
  questions: WireQuestion[];
}

export interface WireFunction {
  id: string; // ReviewFunctionDef.key — same value used as FunctionWorkPaper.functionKey
  label: string;
  triggers: Triggers;
  isActive: boolean;
  sections: WireSection[];
}

// Function-level scope gates for the five shipped defaults, mirroring the
// original hardcoded switch in services/workPapers.ts: InfoSec and MRM apply
// to every classified system, the other three are risk-factor gated.
const DEFAULT_FUNCTION_TRIGGERS: Record<string, Triggers> = {
  INFOSEC: { deliveryModels: [], capabilityTiers: [], riskFactors: [] },
  MRM: { deliveryModels: [], capabilityTiers: [], riskFactors: [] },
  COMPLIANCE: { deliveryModels: [], capabilityTiers: [], riskFactors: [2, 10] },
  PRIVACY: { deliveryModels: [], capabilityTiers: [], riskFactors: [1] },
  FIU: { deliveryModels: [], capabilityTiers: [], riskFactors: [10] },
};

// Guards against a race where several concurrent requests each see an empty
// table and all try to insert the same defaults (unique constraint crash).
// Caching the in-flight promise means only the first caller actually seeds;
// everyone else awaits that same attempt.
let seedPromise: Promise<void> | null = null;

function seedDefaultsIfEmpty(): Promise<void> {
  if (!seedPromise) seedPromise = doSeedDefaultsIfEmpty();
  return seedPromise;
}

async function doSeedDefaultsIfEmpty() {
  const count = await prisma.reviewFunctionDef.count();
  if (count > 0) return;

  let functionOrder = 0;
  for (const def of Object.values(REVIEW_FUNCTIONS)) {
    const triggers = DEFAULT_FUNCTION_TRIGGERS[def.key] ?? { deliveryModels: [], capabilityTiers: [], riskFactors: [] };
    const fn = await prisma.reviewFunctionDef.create({
      data: {
        key: def.key,
        label: def.label,
        triggerDeliveryModels: JSON.stringify(triggers.deliveryModels),
        triggerCapabilityTiers: JSON.stringify(triggers.capabilityTiers),
        triggerRiskFactors: JSON.stringify(triggers.riskFactors),
        sortOrder: functionOrder++,
      },
    });

    let sectionOrder = 0;
    for (const section of def.sections) {
      const sectionRow = await prisma.workPaperSectionDef.create({
        data: {
          functionId: fn.id,
          key: section.id,
          title: section.title,
          triggerLabel: section.triggerLabel,
          triggerDeliveryModels: JSON.stringify(section.triggers.deliveryModels),
          triggerCapabilityTiers: JSON.stringify(section.triggers.capabilityTiers),
          triggerRiskFactors: JSON.stringify(section.triggers.riskFactors),
          sortOrder: sectionOrder++,
        },
      });

      await prisma.workPaperQuestionDef.createMany({
        data: section.questions.map((q, i) => ({
          sectionId: sectionRow.id,
          key: q.id,
          text: q.text,
          citation: q.citation,
          sortOrder: i,
        })),
      });
    }
  }
}

function parseTriggers(row: { triggerDeliveryModels: string; triggerCapabilityTiers: string; triggerRiskFactors: string }): Triggers {
  return {
    deliveryModels: JSON.parse(row.triggerDeliveryModels),
    capabilityTiers: JSON.parse(row.triggerCapabilityTiers),
    riskFactors: JSON.parse(row.triggerRiskFactors),
  };
}

function toWireQuestion(row: WorkPaperQuestionDefRow): WireQuestion {
  return { id: row.key, text: row.text, citation: row.citation, isActive: row.isActive };
}

function toWireSection(row: WorkPaperSectionDefRow & { questions: WorkPaperQuestionDefRow[] }): WireSection {
  return {
    id: row.key,
    title: row.title,
    triggerLabel: row.triggerLabel,
    triggers: parseTriggers(row),
    isActive: row.isActive,
    questions: row.questions.sort((a, b) => a.sortOrder - b.sortOrder).map(toWireQuestion),
  };
}

function toWireFunction(
  row: ReviewFunctionDefRow & { sections: (WorkPaperSectionDefRow & { questions: WorkPaperQuestionDefRow[] })[] }
): WireFunction {
  return {
    id: row.key,
    label: row.label,
    triggers: parseTriggers(row),
    isActive: row.isActive,
    sections: row.sections.sort((a, b) => a.sortOrder - b.sortOrder).map(toWireSection),
  };
}

// Every function/section/question, including inactive — for admin
// management and for label lookups against work papers that reference a
// since-deactivated function.
export async function getAllReviewFunctions(): Promise<WireFunction[]> {
  await seedDefaultsIfEmpty();
  const rows = await prisma.reviewFunctionDef.findMany({
    include: { sections: { include: { questions: true } } },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(toWireFunction);
}

function toNumber(id: string | null): number | null {
  if (!id) return null;
  const n = parseInt(id.slice(1), 10);
  return Number.isNaN(n) ? null : n;
}

export function matchesTriggers(
  triggers: Triggers,
  deliveryModel: string | null,
  capabilityTier: string | null,
  riskFactors: number[]
): boolean {
  const D = toNumber(deliveryModel);
  const T = toNumber(capabilityTier);
  const dMatch = triggers.deliveryModels.length === 0 || (D !== null && triggers.deliveryModels.includes(D));
  const tMatch = triggers.capabilityTiers.length === 0 || (T !== null && triggers.capabilityTiers.includes(T));
  const rMatch = triggers.riskFactors.length === 0 || triggers.riskFactors.some((rf) => riskFactors.includes(rf));
  if (triggers.riskFactors.length > 0) return (dMatch && tMatch) || rMatch;
  return dMatch && tMatch;
}

export async function getInScopeFunctions(
  deliveryModel: string | null,
  capabilityTier: string | null,
  riskFactors: number[]
): Promise<string[]> {
  if (!deliveryModel || !capabilityTier) return [];
  const functions = await getAllReviewFunctions();
  return functions.filter((f) => f.isActive && matchesTriggers(f.triggers, deliveryModel, capabilityTier, riskFactors)).map((f) => f.id);
}

export async function getFunctionByKey(functionKey: string): Promise<WireFunction | null> {
  const functions = await getAllReviewFunctions();
  return functions.find((f) => f.id === functionKey) ?? null;
}

export async function getInScopeSections(
  functionKey: string,
  deliveryModel: string | null,
  capabilityTier: string | null,
  riskFactors: number[]
): Promise<WireSection[]> {
  const fn = await getFunctionByKey(functionKey);
  if (!fn) return [];
  return fn.sections
    .filter((s) => s.isActive && matchesTriggers(s.triggers, deliveryModel, capabilityTier, riskFactors))
    .map((s) => ({ ...s, questions: s.questions.filter((q) => q.isActive) }));
}

export async function getFunctionLabel(functionKey: string): Promise<string> {
  const fn = await getFunctionByKey(functionKey);
  return fn?.label ?? functionKey;
}
