import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const auditRouter = Router();
auditRouter.use(requireAuth);

auditRouter.get("/systems/:systemId/audit", async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { aiSystemId: req.params.systemId },
    include: { actor: { select: { name: true, role: true } } },
    orderBy: { timestamp: "desc" },
  });
  res.json(logs);
});
