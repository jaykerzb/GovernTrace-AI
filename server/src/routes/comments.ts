import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { notifyUser } from "../services/notifications.js";
import { hasPermission } from "../services/permissions.js";

export const commentsRouter = Router();
commentsRouter.use(requireAuth);

commentsRouter.get("/systems/:systemId/comments", async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { aiSystemId: req.params.systemId },
    include: { author: { select: { name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(comments);
});

const bodySchema = z.object({ body: z.string().min(1) });

commentsRouter.post("/systems/:systemId/comments", async (req: AuthedRequest, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const system = await prisma.aiSystem.findUnique({ where: { id: req.params.systemId }, select: { id: true, name: true, ownerId: true } });
  if (!system) return res.status(404).json({ error: "Not found" });

  const comment = await prisma.comment.create({
    data: { aiSystemId: system.id, authorId: req.user!.userId, body: parsed.data.body },
    include: { author: { select: { name: true, role: true } } },
  });

  if (system.ownerId !== req.user!.userId) {
    await notifyUser(
      system.ownerId,
      `${comment.author.name} commented on "${system.name}".`,
      `/systems/${system.id}#comment-${comment.id}`,
      { kind: "COMMENT_POSTED", variables: { authorName: comment.author.name, systemName: system.name } }
    );
  }

  res.status(201).json(comment);
});

commentsRouter.patch("/comments/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.authorId !== req.user!.userId) {
    return res.status(403).json({ error: "You can only edit your own comments." });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const comment = await prisma.comment.update({
    where: { id: existing.id },
    data: { body: parsed.data.body, editedAt: new Date() },
    include: { author: { select: { name: true, role: true } } },
  });

  res.json(comment);
});

commentsRouter.delete("/comments/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.authorId !== req.user!.userId && !(await hasPermission(req.user!.role, "DELETE_ANY_COMMENT"))) {
    return res.status(403).json({ error: "Only the comment's author or an admin can delete it." });
  }

  await prisma.comment.delete({ where: { id: existing.id } });
  res.status(204).end();
});
