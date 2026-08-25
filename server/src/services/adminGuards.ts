import { prisma } from "../lib/prisma.js";

/**
 * Throws-by-return-value guard: ensures deactivating/demoting the given user
 * would not leave the system with zero active Admins. Call this BEFORE
 * applying a deactivation or role change away from ADMIN.
 */
export async function wouldRemoveLastActiveAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ADMIN" || !user.isActive) return false;

  const otherActiveAdmins = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: userId } },
  });
  return otherActiveAdmins === 0;
}
