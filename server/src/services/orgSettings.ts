import { prisma } from "../lib/prisma.js";

const SINGLETON_ID = "singleton";

export async function getOrgSettings() {
  // upsert is atomic at the DB level, so concurrent first-requests can't
  // race each other into a duplicate-key crash the way a
  // findUnique-then-create pattern would.
  return prisma.orgSettings.upsert({ where: { id: SINGLETON_ID }, update: {}, create: { id: SINGLETON_ID } });
}

export async function updateOrgSettings(data: {
  orgName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  approvalAuthorityLowLabel?: string;
  approvalAuthorityHighLabel?: string;
  showApprovalAuthorityLabels?: boolean;
  approvalThreshold?: number;
  reassessmentCadenceDays?: number;
}) {
  await getOrgSettings(); // ensures the singleton row exists before updating
  return prisma.orgSettings.update({ where: { id: SINGLETON_ID }, data });
}
