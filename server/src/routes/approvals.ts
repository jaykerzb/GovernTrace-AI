import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { notifyUser, notifyRoles } from "../services/notifications.js";

export const approvalsRouter = Router();
approvalsRouter.use(requireAuth);

approvalsRouter.get("/systems/:systemId/approval-steps", async (req, res) => {
  const steps = await prisma.approvalStep.findMany({
    where: { aiSystemId: req.params.systemId },
    include: { approver: { select: { name: true } } },
    orderBy: { sortOrder: "asc" },
  });
  res.json(steps);
});

const decideSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
});

approvalsRouter.post(
  "/approval-steps/:id/decide",
  requirePermission("DECIDE_APPROVAL"),
  async (req: AuthedRequest, res) => {
    const parsed = decideSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const step = await prisma.approvalStep.findUnique({ where: { id: req.params.id } });
    if (!step) return res.status(404).json({ error: "Not found" });
    if (step.status !== "PENDING") return res.status(400).json({ error: "This step has already been decided." });

    if (req.user!.role !== "ADMIN" && req.user!.role !== step.requiredRole) {
      return res.status(403).json({ error: `Only a ${step.requiredRole.replace("_", " ")} can act on this step.` });
    }

    const priorSteps = await prisma.approvalStep.findMany({
      where: { aiSystemId: step.aiSystemId, sortOrder: { lt: step.sortOrder } },
    });
    if (priorSteps.some((s) => s.status !== "APPROVED")) {
      return res.status(400).json({ error: "A prior approval step hasn't been completed yet." });
    }

    const updated = await prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: parsed.data.status,
        comment: parsed.data.comment ?? null,
        approverId: req.user!.userId,
        actedAt: new Date(),
      },
    });

    const aiSystem = await prisma.aiSystem.findUnique({
      where: { id: step.aiSystemId },
      select: { id: true, name: true, ownerId: true },
    });

    await logAudit({
      entityType: "ApprovalStep",
      entityId: updated.id,
      aiSystemId: step.aiSystemId,
      action: parsed.data.status === "APPROVED" ? "APPROVAL_STEP_APPROVED" : "APPROVAL_STEP_REJECTED",
      actorId: req.user!.userId,
      summary: `${parsed.data.status === "APPROVED" ? "Approved" : "Rejected"} the "${step.stepType.replace(/_/g, " ")}" step${
        parsed.data.comment ? `: ${parsed.data.comment}` : "."
      }`,
    });

    if (parsed.data.status === "REJECTED") {
      if (aiSystem) {
        const email = { kind: "APPROVAL_STEP_REJECTED" as const, variables: { systemName: aiSystem.name } };
        await notifyUser(aiSystem.ownerId, `An approval step for "${aiSystem.name}" was rejected.`, `/systems/${aiSystem.id}`, email);
        await notifyRoles(
          ["COMPLIANCE_OFFICER", "ADMIN"],
          `An approval step for "${aiSystem.name}" was rejected.`,
          `/systems/${aiSystem.id}`,
          email
        );
      }
      return res.json(updated);
    }

    const remainingSteps = await prisma.approvalStep.findMany({
      where: { aiSystemId: step.aiSystemId },
      orderBy: { sortOrder: "asc" },
    });
    const nextPending = remainingSteps.find((s) => s.status === "PENDING");

    if (!nextPending) {
      // Last step approved — the system is fully signed off.
      await prisma.aiSystem.update({ where: { id: step.aiSystemId }, data: { status: "APPROVED" } });
      if (aiSystem) {
        await notifyUser(
          aiSystem.ownerId,
          `"${aiSystem.name}" has been fully approved.`,
          `/systems/${aiSystem.id}`,
          { kind: "APPROVAL_FULLY_APPROVED", variables: { systemName: aiSystem.name } }
        );
      }
    } else if (aiSystem) {
      await notifyRoles(
        [nextPending.requiredRole],
        `"${aiSystem.name}" is awaiting your approval.`,
        `/systems/${aiSystem.id}`,
        { kind: "APPROVAL_PENDING", variables: { systemName: aiSystem.name } }
      );
    }

    res.json(updated);
  }
);
