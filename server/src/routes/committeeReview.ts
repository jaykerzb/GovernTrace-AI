import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { getAllReviewFunctions } from "../services/functionWorkPapers.js";
import { notifyUser, notifyRoles } from "../services/notifications.js";
import { getOrgSettings } from "../services/orgSettings.js";
import { createApprovalSteps } from "../services/approvalSteps.js";

export const committeeReviewRouter = Router();
committeeReviewRouter.use(requireAuth);

const DISPOSITIONS = ["APPROVED", "APPROVED_WITH_CONDITIONS", "NOT_APPROVED", "DEFERRED", "REMANDED"] as const;

async function findOrCreate(aiSystemId: string) {
  const existing = await prisma.committeeReview.findUnique({
    where: { aiSystemId },
    include: { finalizedBy: { select: { name: true } } },
  });
  if (existing) return existing;
  return prisma.committeeReview.create({
    data: { aiSystemId },
    include: { finalizedBy: { select: { name: true } } },
  });
}

committeeReviewRouter.get("/systems/:systemId/committee-review", async (req, res) => {
  const system = await prisma.aiSystem.findUnique({ where: { id: req.params.systemId } });
  if (!system) return res.status(404).json({ error: "System not found" });

  const review = await findOrCreate(req.params.systemId);
  const workPapers = await prisma.functionWorkPaper.findMany({
    where: { aiSystemId: req.params.systemId },
    include: { reviewedBy: { select: { name: true } } },
    orderBy: { functionKey: "asc" },
  });
  const functions = await getAllReviewFunctions();
  const labelByKey = new Map(functions.map((f) => [f.id, f.label]));

  res.json({
    ...review,
    workPapers: workPapers.map((wp) => ({
      id: wp.id,
      functionKey: wp.functionKey,
      label: labelByKey.get(wp.functionKey) ?? wp.functionKey,
      status: wp.status,
      compositeRiskRating: wp.compositeRiskRating,
      overallRecommendation: wp.overallRecommendation,
      reviewerName: wp.reviewerName,
      reviewedBy: wp.reviewedBy,
    })),
  });
});

const updateSchema = z.object({
  crossFunctionalConflicts: z.string().nullable().optional(),
  committeeDiscussion: z.string().nullable().optional(),
  finalDisposition: z.enum(DISPOSITIONS).nullable().optional(),
  decisionJustification: z.string().nullable().optional(),
});

committeeReviewRouter.patch(
  "/committee-review/:id",
  requirePermission("MANAGE_COMMITTEE_REVIEW"),
  async (req: AuthedRequest, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await prisma.committeeReview.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status === "FINALIZED") {
      return res.status(400).json({ error: "This committee summary is finalized. Reopen it first." });
    }

    const review = await prisma.committeeReview.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { finalizedBy: { select: { name: true } } },
    });
    res.json(review);
  }
);

committeeReviewRouter.post(
  "/committee-review/:id/finalize",
  requirePermission("MANAGE_COMMITTEE_REVIEW"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.committeeReview.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status === "FINALIZED") return res.status(400).json({ error: "Already finalized" });
    if (!existing.finalDisposition) {
      return res.status(400).json({ error: "A final disposition is required before finalizing." });
    }

    const review = await prisma.committeeReview.update({
      where: { id: req.params.id },
      data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: req.user!.userId },
      include: { finalizedBy: { select: { name: true } } },
    });

    await logAudit({
      entityType: "CommitteeReview",
      entityId: review.id,
      aiSystemId: review.aiSystemId,
      action: "FINALIZED",
      actorId: req.user!.userId,
      summary: `Finalized the committee summary: ${review.finalDisposition}.`,
    });

    // Approved systems come up for re-assessment on the org's configured
    // cadence; other dispositions don't put a system into production, so
    // there's nothing to re-review yet.
    const isApproved = review.finalDisposition === "APPROVED" || review.finalDisposition === "APPROVED_WITH_CONDITIONS";
    let nextReviewDue: Date | null = null;
    if (isApproved) {
      const orgSettings = await getOrgSettings();
      nextReviewDue = new Date(review.finalizedAt!.getTime() + orgSettings.reassessmentCadenceDays * 24 * 60 * 60 * 1000);
    }

    const aiSystem = await prisma.aiSystem.update({
      where: { id: review.aiSystemId },
      data: { nextReviewDue },
      select: { ownerId: true, name: true, currentApprovalAuthority: true },
    });

    await notifyUser(
      aiSystem.ownerId,
      `Committee decision for "${aiSystem.name}": ${review.finalDisposition}.`,
      `/systems/${review.aiSystemId}`,
      { kind: "COMMITTEE_DECISION", variables: { systemName: aiSystem.name, disposition: String(review.finalDisposition) } }
    );

    // An approval-type disposition kicks off the formal sign-off chain;
    // other dispositions (not approved/deferred/remanded) don't.
    if (isApproved && aiSystem.currentApprovalAuthority) {
      const steps = await createApprovalSteps(review.aiSystemId, aiSystem.currentApprovalAuthority);
      const firstPending = steps.find((s) => s.status === "PENDING");
      if (firstPending) {
        await notifyRoles(
          [firstPending.requiredRole],
          `"${aiSystem.name}" is awaiting your approval.`,
          `/systems/${review.aiSystemId}`,
          { kind: "APPROVAL_PENDING", variables: { systemName: aiSystem.name } }
        );
      }
    }

    res.json(review);
  }
);

committeeReviewRouter.post(
  "/committee-review/:id/reopen",
  requirePermission("MANAGE_COMMITTEE_REVIEW"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.committeeReview.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.status !== "FINALIZED") return res.status(400).json({ error: "Only a finalized committee summary can be reopened" });

    const review = await prisma.committeeReview.update({
      where: { id: req.params.id },
      data: { status: "DRAFT", finalizedAt: null },
      include: { finalizedBy: { select: { name: true } } },
    });

    await logAudit({
      entityType: "CommitteeReview",
      entityId: review.id,
      aiSystemId: review.aiSystemId,
      action: "REOPENED",
      actorId: req.user!.userId,
      summary: "Reopened the committee summary.",
    });

    res.json(review);
  }
);
