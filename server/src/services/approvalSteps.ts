import type { ApprovalAuthority } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Step templates by approval-authority tier. Low tier is a single sign-off;
// high tier is a two-step chain (review, then final approval) since it
// represents the org's higher-risk band.
const STEP_TEMPLATES: Record<ApprovalAuthority, { stepType: string; requiredRole: "APPROVER" | "ADMIN" }[]> = {
  AIGA: [{ stepType: "AIGA_APPROVAL", requiredRole: "APPROVER" }],
  AISC: [
    { stepType: "AISC_REVIEW", requiredRole: "APPROVER" },
    { stepType: "AISC_FINAL_APPROVAL", requiredRole: "ADMIN" },
  ],
};

// Idempotent: if this system already has approval steps (e.g. the committee
// summary was reopened and re-finalized), does nothing rather than
// duplicating the chain.
export async function createApprovalSteps(aiSystemId: string, authority: ApprovalAuthority) {
  const existingCount = await prisma.approvalStep.count({ where: { aiSystemId } });
  if (existingCount > 0) return prisma.approvalStep.findMany({ where: { aiSystemId }, orderBy: { sortOrder: "asc" } });

  const template = STEP_TEMPLATES[authority];
  await prisma.approvalStep.createMany({
    data: template.map((step, index) => ({
      aiSystemId,
      stepType: step.stepType,
      requiredRole: step.requiredRole,
      sortOrder: index,
    })),
  });

  return prisma.approvalStep.findMany({ where: { aiSystemId }, orderBy: { sortOrder: "asc" } });
}
