import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";

export const myQueueRouter = Router();
myQueueRouter.use(requireAuth);

myQueueRouter.get("/my-queue", async (req: AuthedRequest, res) => {
  const { userId, role } = req.user!;

  const isReviewer = role === "ADMIN" || role === "COMPLIANCE_OFFICER";

  const reassessmentHorizon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const [draftIntakes, draftAssessments, openWorkPapers, readyCommitteeReviews, dueForReassessment] = await Promise.all([
    // Systems this user owns that are still in DRAFT/INTAKE.
    prisma.aiSystem.findMany({
      where: { ownerId: userId, status: { in: ["DRAFT", "INTAKE"] } },
      select: { id: true, name: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    // Draft risk assessments on systems this user owns.
    prisma.riskAssessment.findMany({
      where: { status: "DRAFT", aiSystem: { ownerId: userId } },
      select: { id: true, version: true, aiSystemId: true, aiSystem: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Function work papers not yet complete, for reviewer roles.
    isReviewer
      ? prisma.functionWorkPaper.findMany({
          where: { status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
          select: {
            id: true,
            functionKey: true,
            status: true,
            aiSystemId: true,
            aiSystem: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    // Committee reviews with a disposition set but not yet finalized, for reviewer roles.
    isReviewer
      ? prisma.committeeReview.findMany({
          where: { status: "DRAFT", finalDisposition: { not: null } },
          select: { id: true, aiSystemId: true, finalDisposition: true, aiSystem: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    // Systems this user owns that are due (or overdue) for re-assessment.
    prisma.aiSystem.findMany({
      where: { ownerId: userId, nextReviewDue: { lte: reassessmentHorizon } },
      orderBy: { nextReviewDue: "asc" },
      select: { id: true, name: true, nextReviewDue: true },
    }),
  ]);

  res.json({
    draftIntakes,
    draftAssessments: draftAssessments.map((a) => ({
      id: a.id,
      version: a.version,
      aiSystemId: a.aiSystemId,
      aiSystemName: a.aiSystem.name,
    })),
    openWorkPapers: openWorkPapers.map((wp) => ({
      id: wp.id,
      functionKey: wp.functionKey,
      status: wp.status,
      aiSystemId: wp.aiSystemId,
      aiSystemName: wp.aiSystem.name,
    })),
    readyCommitteeReviews: readyCommitteeReviews.map((cr) => ({
      id: cr.id,
      aiSystemId: cr.aiSystemId,
      finalDisposition: cr.finalDisposition,
      aiSystemName: cr.aiSystem.name,
    })),
    dueForReassessment: dueForReassessment.map((s) => ({ id: s.id, name: s.name, nextReviewDue: s.nextReviewDue })),
  });
});
