import { prisma } from "../lib/prisma.js";
import { getInScopeFunctions } from "./workPapers.js";

// Ensures a FunctionWorkPaper row exists for every review function that is
// in scope for the system's current classification. Existing rows (and
// their answers/status) are left untouched; this only ever adds coverage as
// a system's classification changes, it never removes a work paper so
// history/evidence isn't lost.
export async function syncWorkPapersForSystem(aiSystemId: string, deliveryModel: string | null, capabilityTier: string | null, riskFactors: number[]) {
  const inScope = await getInScopeFunctions(deliveryModel, capabilityTier, riskFactors);
  if (inScope.length === 0) return;

  const existing = await prisma.functionWorkPaper.findMany({
    where: { aiSystemId },
    select: { functionKey: true },
  });
  const existingKeys = new Set(existing.map((e) => e.functionKey));

  const missing = inScope.filter((k) => !existingKeys.has(k));
  if (missing.length === 0) return;

  await prisma.functionWorkPaper.createMany({
    data: missing.map((functionKey) => ({ aiSystemId, functionKey })),
  });
}
