import { Router } from "express";
import { Prisma, type SystemStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getAllReviewFunctions } from "../services/functionWorkPapers.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

const RISK_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// All optional — an absent filter means "no restriction on that dimension",
// matching the registry table's own filter semantics.
function buildSystemFilter(req: { query: Record<string, unknown> }): Prisma.AiSystemWhereInput {
  const { businessUnit, status, dateFrom, dateTo } = req.query;
  const where: Prisma.AiSystemWhereInput = {};
  if (typeof businessUnit === "string" && businessUnit) where.businessUnit = businessUnit;
  if (typeof status === "string" && status) where.status = status as SystemStatus;
  if (typeof dateFrom === "string" || typeof dateTo === "string") {
    where.createdAt = {
      ...(typeof dateFrom === "string" && dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(typeof dateTo === "string" && dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
    };
  }
  return where;
}

// Backs the filter dropdown — every distinct business unit currently in
// use, independent of any filter already applied on the main endpoint.
analyticsRouter.get("/analytics/business-units", async (_req, res) => {
  const rows = await prisma.aiSystem.findMany({ distinct: ["businessUnit"], select: { businessUnit: true }, orderBy: { businessUnit: "asc" } });
  res.json(rows.map((r) => r.businessUnit));
});

const RISK_SEVERITY: Record<string, number> = { Low: 1, Moderate: 2, High: 3, Critical: 4 };

const CUSTOM_DIMENSIONS = ["businessUnit", "status", "aiType", "owner", "riskRating", "month"] as const;
type CustomDimension = (typeof CUSTOM_DIMENSIONS)[number];

const CUSTOM_METRICS = ["count", "avgScore"] as const;
type CustomMetric = (typeof CUSTOM_METRICS)[number];

interface CustomRow {
  businessUnit: string;
  status: string;
  aiType: string;
  owner: { name: string };
  currentScore: number | null;
  createdAt: Date;
  workPapers: { compositeRiskRating: string | null }[];
}

// The worst (highest-severity) composite rating across a system's function
// work papers — the same "risk rating" every other view in the app (the
// dashboard, My Queue) uses, rather than re-deriving one from the risk
// assessment score band, so a custom report's numbers match what users
// already see elsewhere.
function worstRiskRating(row: CustomRow): string {
  let worst: string | null = null;
  for (const wp of row.workPapers) {
    if (wp.compositeRiskRating && (!worst || RISK_SEVERITY[wp.compositeRiskRating] > RISK_SEVERITY[worst])) {
      worst = wp.compositeRiskRating;
    }
  }
  return worst ?? "NOT_RATED";
}

function dimensionKey(row: CustomRow, dimension: CustomDimension): string {
  switch (dimension) {
    case "businessUnit":
      return row.businessUnit;
    case "status":
      return row.status;
    case "aiType":
      return row.aiType;
    case "owner":
      return row.owner.name;
    case "riskRating":
      return worstRiskRating(row);
    case "month":
      return monthKey(row.createdAt);
  }
}

// Backs the custom report builder on the Analytics page — lets a user pick
// any dimension/metric combination instead of the fixed charts above.
analyticsRouter.get("/analytics/custom", async (req, res) => {
  const { dimension, metric } = req.query;
  if (typeof dimension !== "string" || !CUSTOM_DIMENSIONS.includes(dimension as CustomDimension)) {
    return res.status(400).json({ error: `dimension must be one of: ${CUSTOM_DIMENSIONS.join(", ")}` });
  }
  if (typeof metric !== "string" || !CUSTOM_METRICS.includes(metric as CustomMetric)) {
    return res.status(400).json({ error: `metric must be one of: ${CUSTOM_METRICS.join(", ")}` });
  }

  const systemFilter = buildSystemFilter(req);
  const rows = await prisma.aiSystem.findMany({
    where: systemFilter,
    select: {
      businessUnit: true,
      status: true,
      aiType: true,
      owner: { select: { name: true } },
      currentScore: true,
      createdAt: true,
      workPapers: { select: { compositeRiskRating: true } },
    },
  });

  const groups = new Map<string, CustomRow[]>();
  for (const row of rows) {
    const key = dimensionKey(row, dimension as CustomDimension);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const data = Array.from(groups, ([label, group]) => ({
    label,
    value:
      metric === "count"
        ? group.length
        : (() => {
            const scores = group.map((r) => r.currentScore).filter((s): s is number => s !== null);
            return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
          })(),
  }));

  // Chronological, not by value, for the one dimension where reading order
  // matters more than magnitude — everything else sorts biggest-first.
  data.sort(dimension === "month" ? (a, b) => a.label.localeCompare(b.label) : (a, b) => b.value - a.value);

  res.json({ dimension, metric, data });
});

analyticsRouter.get("/analytics", async (req, res) => {
  const systemFilter = buildSystemFilter(req);
  const hasSystemFilter = Object.keys(systemFilter).length > 0;

  const [workPaperRatings, allSystems, businessUnitGroups, openWorkPapers, finalizedReviews, reviewFunctions] = await Promise.all([
    prisma.functionWorkPaper.groupBy({
      by: ["compositeRiskRating"],
      _count: true,
      where: { compositeRiskRating: { not: null }, aiSystem: systemFilter },
    }),
    prisma.aiSystem.findMany({ where: systemFilter, select: { createdAt: true } }),
    // groupBy can't filter on a relation, so when a system-level filter is
    // active this falls back to fetching the matching systems' business
    // units directly and counting them in memory instead.
    hasSystemFilter
      ? prisma.aiSystem.findMany({ where: systemFilter, select: { businessUnit: true } }).then((rows) => {
          const counts = new Map<string, number>();
          for (const r of rows) counts.set(r.businessUnit, (counts.get(r.businessUnit) ?? 0) + 1);
          return Array.from(counts, ([businessUnit, count]) => ({ businessUnit, _count: count }));
        })
      : prisma.aiSystem.groupBy({ by: ["businessUnit"], _count: true }),
    prisma.functionWorkPaper.groupBy({
      by: ["functionKey"],
      _count: true,
      where: { status: { in: ["NOT_STARTED", "IN_PROGRESS"] }, aiSystem: systemFilter },
    }),
    prisma.committeeReview.findMany({
      where: { status: "FINALIZED", finalizedAt: { not: null }, aiSystem: systemFilter },
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
