import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { getInScopeSections, getFunctionLabel, getAllReviewFunctions } from "../services/functionWorkPapers.js";
import { notifyUser } from "../services/notifications.js";

export const workPapersRouter = Router();
workPapersRouter.use(requireAuth);

// Lightweight key/label list — any authenticated role, not just Admins (My
// Queue and other dashboard views need function labels too).
workPapersRouter.get("/review-functions", async (_req, res) => {
  const functions = await getAllReviewFunctions();
  res.json(functions.filter((f) => f.isActive).map((f) => ({ key: f.id, label: f.label })));
});

async function latestClassification(aiSystemId: string) {
  const latest = await prisma.riskAssessment.findFirst({
    where: { aiSystemId, status: "FINALIZED" },
    orderBy: { version: "desc" },
    select: { deliveryModel: true, capabilityTier: true, riskFactors: true },
  });
  let riskFactors: number[] = [];
  try {
    riskFactors = latest?.riskFactors ? JSON.parse(latest.riskFactors) : [];
  } catch {
    riskFactors = [];
  }
  return { deliveryModel: latest?.deliveryModel ?? null, capabilityTier: latest?.capabilityTier ?? null, riskFactors };
}

workPapersRouter.get("/systems/:systemId/work-papers", async (req, res) => {
  const workPapers = await prisma.functionWorkPaper.findMany({
    where: { aiSystemId: req.params.systemId },
    include: { reviewedBy: { select: { name: true } } },
    orderBy: { functionKey: "asc" },
  });
  const { deliveryModel, capabilityTier, riskFactors } = await latestClassification(req.params.systemId);

  const withProgress = await Promise.all(
    workPapers.map(async (wp) => {
      const sections = await getInScopeSections(wp.functionKey, deliveryModel, capabilityTier, riskFactors);
      const questionIds = sections.flatMap((s) => s.questions.map((q) => q.id));
      let answers: Record<string, string> = {};
      try {
        answers = JSON.parse(wp.answers);
      } catch {
        answers = {};
      }
      const answeredCount = questionIds.filter((id) => answers[id]).length;
      return {
        ...wp,
        label: await getFunctionLabel(wp.functionKey),
        totalQuestions: questionIds.length,
        answeredCount,
      };
    })
  );

  res.json(withProgress);
});

workPapersRouter.get("/work-papers/:id", async (req, res) => {
  const wp = await prisma.functionWorkPaper.findUnique({
    where: { id: req.params.id },
    include: { reviewedBy: { select: { name: true } } },
  });
  if (!wp) return res.status(404).json({ error: "Not found" });

  const { deliveryModel, capabilityTier, riskFactors } = await latestClassification(wp.aiSystemId);
  const sections = await getInScopeSections(wp.functionKey, deliveryModel, capabilityTier, riskFactors);

  res.json({ ...wp, label: await getFunctionLabel(wp.functionKey), sections });
});

const SECTION_RISK_RATINGS = ["Low", "Moderate", "High", "Critical", "N/A"] as const;
const COMPOSITE_RISK_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;
const RECOMMENDATIONS = ["NO_OBJECTION", "APPROVE_WITH_CONDITIONS", "OBJECTION", "DEFERRED"] as const;

const sectionDataSchema = z.object({
  findings: z.string().optional(),
  identifiedRisks: z.string().optional(),
  mitigatingControls: z.string().optional(),
  requiredActions: z.string().optional(),
  riskRating: z.enum(SECTION_RISK_RATINGS).optional(),
});

const updateSchema = z.object({
  answers: z.record(z.string(), z.string()),
  questionNotes: z.record(z.string(), z.string()).optional(),
  sectionData: z.record(z.string(), sectionDataSchema).optional(),
  compositeRiskRating: z.enum(COMPOSITE_RISK_RATINGS).nullable().optional(),
  overallRecommendation: z.enum(RECOMMENDATIONS).nullable().optional(),
  keyFindings: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
  reviewerName: z.string().nullable().optional(),
  reviewerTitle: z.string().nullable().optional(),
  reviewerDate: z.string().nullable().optional(),
});

workPapersRouter.patch("/work-papers/:id", requirePermission("MANAGE_WORK_PAPERS"), async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.functionWorkPaper.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status === "COMPLETE") {
    return res.status(400).json({ error: "Completed work papers cannot be edited. Reopen it first." });
  }

  const d = parsed.data;
  const hasAnswers = Object.keys(d.answers).length > 0;
  const wp = await prisma.functionWorkPaper.update({
    where: { id: req.params.id },
    data: {
      answers: JSON.stringify(d.answers),
      ...(d.questionNotes !== undefined && { questionNotes: JSON.stringify(d.questionNotes) }),
      ...(d.sectionData !== undefined && { sectionData: JSON.stringify(d.sectionData) }),
      ...(d.compositeRiskRating !== undefined && { compositeRiskRating: d.compositeRiskRating }),
      ...(d.overallRecommendation !== undefined && { overallRecommendation: d.overallRecommendation }),
      ...(d.keyFindings !== undefined && { keyFindings: d.keyFindings }),
      ...(d.rationale !== undefined && { rationale: d.rationale }),
      ...(d.reviewerName !== undefined && { reviewerName: d.reviewerName }),
      ...(d.reviewerTitle !== undefined && { reviewerTitle: d.reviewerTitle }),
      ...(d.reviewerDate !== undefined && { reviewerDate: d.reviewerDate ? new Date(d.reviewerDate) : null }),
      status: hasAnswers ? "IN_PROGRESS" : "NOT_STARTED",
    },
  });

  res.json(wp);
});

workPapersRouter.post("/work-papers/:id/complete", requirePermission("MANAGE_WORK_PAPERS"), async (req: AuthedRequest, res) => {
  const existing = await prisma.functionWorkPaper.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status === "COMPLETE") return res.status(400).json({ error: "Already complete" });

  const { deliveryModel, capabilityTier, riskFactors } = await latestClassification(existing.aiSystemId);
  const sections = await getInScopeSections(existing.functionKey, deliveryModel, capabilityTier, riskFactors);
  const questionIds = sections.flatMap((s) => s.questions.map((q) => q.id));

  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(existing.answers);
  } catch {
    answers = {};
  }
  const unanswered = questionIds.filter((id) => !answers[id]);
  if (unanswered.length > 0) {
    return res.status(400).json({ error: `${unanswered.length} question(s) still need an answer before this work paper can be marked complete.` });
  }

  let sectionData: Record<string, { riskRating?: string }> = {};
  try {
    sectionData = JSON.parse(existing.sectionData);
  } catch {
    sectionData = {};
  }
  const missingRatings = sections.filter((s) => !sectionData[s.id]?.riskRating);
  if (missingRatings.length > 0) {
    return res.status(400).json({ error: `${missingRatings.length} section(s) still need a risk rating before this work paper can be marked complete.` });
  }

  if (!existing.compositeRiskRating) {
    return res.status(400).json({ error: "A composite risk rating is required before this work paper can be marked complete." });
  }

  const wp = await prisma.functionWorkPaper.update({
    where: { id: req.params.id },
    data: { status: "COMPLETE", completedAt: new Date(), reviewedById: req.user!.userId },
  });

  const functionLabel = await getFunctionLabel(wp.functionKey);

  await logAudit({
    entityType: "FunctionWorkPaper",
    entityId: wp.id,
    aiSystemId: wp.aiSystemId,
    action: "COMPLETED",
    actorId: req.user!.userId,
    summary: `Completed the ${functionLabel} work paper (composite risk rating: ${wp.compositeRiskRating}).`,
  });

  const aiSystem = await prisma.aiSystem.findUnique({ where: { id: wp.aiSystemId }, select: { ownerId: true, name: true } });
  if (aiSystem) {
    await notifyUser(
      aiSystem.ownerId,
      `${functionLabel} work paper completed for "${aiSystem.name}" (${wp.compositeRiskRating} risk).`,
      `/systems/${wp.aiSystemId}`,
      {
        kind: "WORK_PAPER_COMPLETED",
        variables: { functionLabel, systemName: aiSystem.name, riskRating: String(wp.compositeRiskRating) },
      }
    );
  }

  res.json(wp);
});

workPapersRouter.post("/work-papers/:id/reopen", requirePermission("MANAGE_WORK_PAPERS"), async (req: AuthedRequest, res) => {
  const existing = await prisma.functionWorkPaper.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status !== "COMPLETE") return res.status(400).json({ error: "Only completed work papers can be reopened" });

  const wp = await prisma.functionWorkPaper.update({
    where: { id: req.params.id },
    data: { status: "IN_PROGRESS", completedAt: null },
  });

  await logAudit({
    entityType: "FunctionWorkPaper",
    entityId: wp.id,
    aiSystemId: wp.aiSystemId,
    action: "REOPENED",
    actorId: req.user!.userId,
    summary: `Reopened the ${await getFunctionLabel(wp.functionKey)} work paper.`,
  });

  res.json(wp);
});
