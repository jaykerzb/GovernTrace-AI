import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// Highest severity wins when a system's function work papers disagree.
const RISK_SEVERITY: Record<string, number> = { Low: 1, Moderate: 2, High: 3, Critical: 4 };

const TREND_MONTHS = 6;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

// Last TREND_MONTHS calendar months, oldest first, including the current one.
function lastMonths(count: number): { key: string; label: string; start: Date; end: Date }[] {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({ key: monthKey(start), label: monthLabel(start), start, end });
  }
  return months;
}

dashboardRouter.get("/dashboard", async (_req, res) => {
  const months = lastMonths(TREND_MONTHS);
  const rangeStart = months[0].start;

  // "Awaiting Assessment" used to be one bucket (currentApprovalAuthority
  // null) that blurred together two very different situations — a system
  // that's never had an assessment started, and one with a draft assessment
  // already in progress (which also shows up in that owner's My Queue).
  // Splitting them removes that overlap and tells the viewer which of the
  // two is actually true. A FINALIZED assessment always sets
  // currentApprovalAuthority (see the finalize route), so "null" here can
  // only mean "no assessments at all" or "only draft ones" — the two
  // conditions below are a true partition, not an approximation.
  const notStartedWhere = { riskAssessments: { none: {} } } as const;
  const inProgressWhere = { currentApprovalAuthority: null, riskAssessments: { some: { status: "DRAFT" as const } } };

  const [
    byStatus,
    systemsWithRatings,
    totalSystems,
    notStartedCount,
    notStarted,
    inProgressCount,
    inProgress,
    reviewTriggeredCount,
    flagged,
    recentSystems,
    finalizedAssessments,
  ] = await Promise.all([
    prisma.aiSystem.groupBy({ by: ["status"], _count: true }),
    prisma.aiSystem.findMany({
      select: { id: true, workPapers: { select: { compositeRiskRating: true } } },
    }),
    prisma.aiSystem.count(),
    prisma.aiSystem.count({ where: notStartedWhere }),
    prisma.aiSystem.findMany({ where: notStartedWhere, select: { id: true, name: true, status: true, businessUnit: true }, take: 10 }),
    prisma.aiSystem.count({ where: inProgressWhere }),
    prisma.aiSystem.findMany({ where: inProgressWhere, select: { id: true, name: true, status: true, businessUnit: true }, take: 10 }),
    prisma.aiSystem.count({ where: { currentReviewTriggered: true } }),
    prisma.aiSystem.findMany({
      where: { currentReviewTriggered: true },
      select: { id: true, name: true, status: true, businessUnit: true },
      take: 10,
    }),
    prisma.aiSystem.findMany({ where: { createdAt: { gte: rangeStart } }, select: { createdAt: true } }),
    prisma.riskAssessment.findMany({
      where: { status: "FINALIZED", finalizedAt: { gte: rangeStart } },
      select: { score: true, finalizedAt: true },
    }),
  ]);

  const byRiskRating: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0, NOT_RATED: 0 };
  for (const system of systemsWithRatings) {
    let worst: string | null = null;
    for (const wp of system.workPapers) {
      if (wp.compositeRiskRating && (!worst || RISK_SEVERITY[wp.compositeRiskRating] > RISK_SEVERITY[worst])) {
        worst = wp.compositeRiskRating;
      }
    }
    byRiskRating[worst ?? "NOT_RATED"] += 1;
  }

  const scoresByMonth = new Map<string, number[]>();
  for (const a of finalizedAssessments) {
    if (a.score === null || !a.finalizedAt) continue;
    const key = monthKey(a.finalizedAt);
    const list = scoresByMonth.get(key) ?? [];
    list.push(a.score);
    scoresByMonth.set(key, list);
  }

  const trends = months.map((m) => {
    const registrations = recentSystems.filter((s) => s.createdAt >= m.start && s.createdAt < m.end).length;
    const scores = scoresByMonth.get(m.key) ?? [];
    const avgRiskScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null;
    return { month: m.label, registrations, avgRiskScore };
  });

  res.json({
    totalSystems,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    byRiskRating,
    notStartedCount,
    notStarted,
    inProgressCount,
    inProgress,
    reviewTriggeredCount,
    flagged,
    trends,
  });
});
