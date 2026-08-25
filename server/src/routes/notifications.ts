import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/notifications", async (req: AuthedRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.user!.userId, read: false } });
  res.json({ notifications, unreadCount });
});

notificationsRouter.post("/notifications/:id/read", async (req: AuthedRequest, res) => {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.user!.userId) return res.status(404).json({ error: "Not found" });

  const notification = await prisma.notification.update({ where: { id: existing.id }, data: { read: true } });
  res.json(notification);
});

notificationsRouter.post("/notifications/read-all", async (req: AuthedRequest, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.userId, read: false }, data: { read: true } });
  res.status(204).end();
});
