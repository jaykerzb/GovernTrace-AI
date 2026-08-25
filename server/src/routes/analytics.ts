import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getAllReviewFunctions } from "../services/functionWorkPapers.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const RISK_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

analyticsRouter.get("/analytics", async (_req, res) => {
  const [workPaperRatings, allSystems, businessUnitGroups, openWorkPapers, finalizedReviews, reviewFunctions] = await Promise.all([
    prisma.functionWorkPaper.groupBy({
      by: ["compositeRiskRating"],
      _count: true,
      where: { compositeRiskRating: { not: null } },
    }),
    prisma.aiSystem.findMany({ select: { createdAt: true } }),
    prisma.aiSystem.groupBy({ by: ["businessUnit"], _count: true }),
    prisma.functionWorkPaper.groupBy({
      by: ["functionKey"],
      _count: true,
      where: { status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
    }),
    prisma.committeeReview.findMany({
      where: { status: "FINALIZED", finalizedAt: { not: null } },
      select: { finalizedAt: true, aiSystem: { select: { createdAt: true } } },
    }),
    getAllReviewFunctions(),
  ]);

  const riskDistribution = Object.fromEntries(RISK_RATINGS.map((r) => [r, 0])) as Record<string, number>;
  for (const g of workPaperRatings) {
    if (g.compositeRiskRating && g.compositeRiskRating in riskDistribution) {
      riskDistribution[g.compositeRiskRating] = g._count;
    }
  }

  // Last 6 months, oldest to newest, zero-filled.
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }) });
  }
  const monthCounts = new Map(months.map((m) => [m.key, 0]));
  for (const s of allSystems) {
    const key = monthKey(s.createdAt);
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const registrationsByMonth = months.map((m) => ({ month: m.label, count: monthCounts.get(m.key) ?? 0 }));

  const byBusinessUnit = businessUnitGroups
    .map((g) => ({ businessUnit: g.businessUnit, count: g._count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const workloadByFunction = reviewFunctions
    .filter((f) => f.isActive)
    .map((f) => {
      const match = openWorkPapers.find((g) => g.functionKey === f.id);
      return { functionKey: f.id, label: f.label, count: match?._count ?? 0 };
    });

  const decisionDurations = finalizedReviews
    .filter((r) => r.finalizedAt)
    .map((r) => (r.finalizedAt!.getTime() - r.aiSystem.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const avgDaysToDecision =
    decisionDurations.length > 0 ? decisionDurations.reduce((a, b) => a + b, 0) / decisionDurations.length : null;

  res.json({
    riskDistribution,
    registrationsByMonth,
    byBusinessUnit,
    workloadByFunction,
    avgDaysToDecision,
    decisionSampleSize: decisionDurations.length,
  });
});
