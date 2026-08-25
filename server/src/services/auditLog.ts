import { prisma } from "../lib/prisma.js";

export async function logAudit(params: {
  entityType: string;
  entityId: string;
  // Null for system-level actions not scoped to a specific AI system (user
  // management).
  aiSystemId: string | null;
  action: string;
  actorId: string;
  summary: string;
}) {
  await prisma.auditLog.create({ data: params });
}
