import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { hasPermission } from "../services/permissions.js";
import { scoreToApprovalAuthority, DELIVERY_MODELS, CAPABILITY_TIERS, RISK_FACTORS } from "../services/riskQuestionnaire.js";
import { getActiveRiskQuestions, computeScore, computeReviewTriggered } from "../services/riskQuestions.js";
import { syncWorkPapersForSystem } from "../services/workPaperSync.js";
import { notifyUser, notifyRoles } from "../services/notifications.js";
import { getOrgSettings } from "../services/orgSettings.js";

export const assessmentsRouter = Router();
assessmentsRouter.use(requireAuth);

assessmentsRouter.get("/questionnaire", async (_req, res) => {
  res.json(await getActiveRiskQuestions());
});

assessmentsRouter.get("/classification-options", (_req, res) => {
  res.json({ deliveryModels: DELIVERY_MODELS, capabilityTiers: CAPABILITY_TIERS, riskFactors: RISK_FACTORS });
});

assessmentsRouter.get("/systems/:systemId/assessments", async (req, res) => {
  const assessments = await prisma.riskAssessment.findMany({
    where: { aiSystemId: req.params.systemId },
    orderBy: { version: "desc" },
    include: { assessedBy: { select: { name: true } } },
  });
  res.json(assessments);
});

assessmentsRouter.post(
  "/systems/:systemId/assessments",
  requirePermission("RUN_ASSESSMENT"),
  async (req: AuthedRequest, res) => {
    const system = await prisma.aiSystem.findUnique({ where: { id: req.params.systemId } });
    if (!system) return res.status(404).json({ error: "System not found" });

    const last = await prisma.riskAssessment.findFirst({
      where: { aiSystemId: system.id },
      orderBy: { version: "desc" },
    });

    const assessment = await prisma.riskAssessment.create({
      data: {
        aiSystemId: system.id,
        version: (last?.version ?? 0) + 1,
        answers: "{}",
        assessedById: req.user!.userId,
      },
    });

    await prisma.aiSystem.update({ where: { id: system.id }, data: { status: "RISK_ASSESSMENT" } });
    await logAudit({
      entityType: "RiskAssessment",
      entityId: assessment.id,
      aiSystemId: system.id,
      action: "CREATED",
      actorId: req.user!.userId,
      summary: `Started risk assessment v${assessment.version}.`,
    });

    res.status(201).json(assessment);
  }
);

const updateSchema = z.object({
  answers: z.record(z.string(), z.string()),
  deliveryModel: z.string().nullable().optional(),
  capabilityTier: z.string().nullable().optional(),
  riskFactors: z.array(z.number()).optional(),
});

assessmentsRouter.patch("/assessments/:id", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.riskAssessment.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.status === "FINALIZED") {
    return res.status(400).json({ error: "Finalized assessments cannot be edited" });
  }

  const assessment = await prisma.riskAssessment.update({
    where: { id: req.params.id },
    data: {
      answers: JSON.stringify(parsed.data.answers),
      ...(parsed.data.deliveryModel !== undefined && { deliveryModel: parsed.data.deliveryModel }),
      ...(parsed.data.capabilityTier !== undefined && { capabilityTier: parsed.data.capabilityTier }),
      ...(parsed.data.riskFactors !== undefined && { riskFactors: JSON.stringify(parsed.data.riskFactors) }),
    },
  });
  res.json(assessment);
});

assessmentsRouter.delete("/assessments/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.riskAssessment.findUnique({
    where: { id: req.params.id },
    include: { aiSystem: true },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const role = req.user!.role;
  const isOwner = existing.aiSystem.ownerId === req.user!.userId;
  const canDelete =
    (await hasPermission(role, "DELETE_ASSESSMENT")) &&
    (role !== "SYSTEM_OWNER" || (isOwner && existing.status === "DRAFT"));
  if (!canDelete) {
    return res.status(403).json({
      error:
        role === "SYSTEM_OWNER"
          ? "System owners can only delete their own draft (not yet finalized) assessments"
          : "Insufficient permissions",
    });
  }

  await prisma.riskAssessment.delete({ where: { id: existing.id } });

  // The deleted assessment may have been the one whose result is denormalized
  // onto the system — recompute from whatever the latest finalized
  // assessment now is (or clear it if none remain).
  const latestFinalized = await prisma.riskAssessment.findFirst({
    where: { aiSystemId: existing.aiSystemId, status: "FINALIZED" },
    orderBy: { version: "desc" },
  });
  await prisma.aiSystem.update({
    where: { id: existing.aiSystemId },
    data: {
      currentApprovalAuthority: latestFinalized?.approvalAuthority ?? null,
      currentScore: latestFinalized?.score ?? null,
      currentReviewTriggered: latestFinalized?.reviewTriggered ?? null,
    },
  });

  await logAudit({
    entityType: "RiskAssessment",
    entityId: existing.id,
    aiSystemId: existing.aiSystemId,
    action: "DELETED",
    actorId: req.user!.userId,
    summary: `Deleted risk assessment v${existing.version}.`,
  });

  res.status(204).end();
});

assessmentsRouter.post(
  "/assessments/:id/finalize",
  requirePermission("FINALIZE_ASSESSMENT"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.riskAssessment.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status === "FINALIZED") {
      return res.status(400).json({ error: "Already finalized" });
    }

    const answers = JSON.parse(existing.answers) as Record<string, string>;
    const activeQuestions = await getActiveRiskQuestions();
    const dimension1Questions = activeQuestions.filter((q) => q.dimension === 1);
    const dimension2Questions = activeQuestions.filter((q) => q.dimension === 2);
    const score = computeScore(answers, dimension2Questions);
    const orgSettings = await getOrgSettings();
    const approvalAuthority = scoreToApprovalAuthority(score, orgSettings.approvalThreshold);
    const reviewTriggered = computeReviewTriggered(answers, dimension1Questions);

    const assessment = await prisma.riskAssessment.update({
      where: { id: existing.id },
      data: {
        status: "FINALIZED",
        score,
        approvalAuthority,
        reviewTriggered,
        finalizedAt: new Date(),
        // Snapshot the exact question set this was scored against, so the
        // report stays accurate even if questions are edited/reordered later.
        questionsSnapshot: JSON.stringify(activeQuestions),
      },
    });

    const aiSystem = await prisma.aiSystem.update({
      where: { id: existing.aiSystemId },
      data: { currentApprovalAuthority: approvalAuthority, currentScore: score, currentReviewTriggered: reviewTriggered, status: "UNDER_REVIEW" },
    });

    let riskFactors: number[] = [];
    try {
      riskFactors = existing.riskFactors ? JSON.parse(existing.riskFactors) : [];
    } catch {
      riskFactors = [];
    }
    await syncWorkPapersForSystem(existing.aiSystemId, existing.deliveryModel, existing.capabilityTier, riskFactors);

    // Generic threshold language rather than naming a tier — the org has
    // opted not to expose the tier concept in reporting/notifications. The
    // underlying approvalAuthority value and approval-chain behavior are
    // unaffected.
    const approvalDescription = `${approvalAuthority === "AISC" ? "additional" : "standard"} approval required`;

    await logAudit({
      entityType: "RiskAssessment",
      entityId: assessment.id,
      aiSystemId: existing.aiSystemId,
      action: "FINALIZED",
      actorId: req.user!.userId,
      summary: `Finalized risk assessment v${assessment.version}: ${approvalDescription} (score ${score})${reviewTriggered ? "; flagged for additional review" : ""}.`,
    });

    await notifyUser(
      aiSystem.ownerId,
      `Risk assessment finalized for "${aiSystem.name}": ${approvalDescription} (score ${score}).`,
      `/systems/${aiSystem.id}`,
      { kind: "ASSESSMENT_FINALIZED", variables: { systemName: aiSystem.name, approvalDescription, score: String(score) } }
    );
    if (approvalAuthority === "AISC") {
      await notifyRoles(
        ["ADMIN", "COMPLIANCE_OFFICER"],
        `"${aiSystem.name}" requires additional approval (score ${score}).`,
        `/systems/${aiSystem.id}`,
        { kind: "ASSESSMENT_ADDITIONAL_APPROVAL", variables: { systemName: aiSystem.name, score: String(score) } }
      );
    }

    res.json(assessment);
  }
);
