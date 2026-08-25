import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { logAudit } from "../services/auditLog.js";
import { hasPermission } from "../services/permissions.js";

export const meetingsRouter = Router();
meetingsRouter.use(requireAuth);

const DEFAULT_FROM_MS = 30 * 24 * 60 * 60 * 1000; // 1 month back
const DEFAULT_TO_MS = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months ahead

export function resolveRange(from?: string, to?: string) {
  const now = Date.now();
  return {
    from: from ? new Date(from) : new Date(now - DEFAULT_FROM_MS),
    to: to ? new Date(to) : new Date(now + DEFAULT_TO_MS),
  };
}

meetingsRouter.get("/meetings", async (req, res) => {
  const { from, to } = resolveRange(req.query.from as string | undefined, req.query.to as string | undefined);
  const meetings = await prisma.meeting.findMany({
    where: { date: { gte: from, lte: to } },
    include: { aiSystem: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });
  res.json(meetings);
});

const meetingInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  date: z.string().min(1),
  aiSystemId: z.string().optional().nullable(),
});

meetingsRouter.post("/meetings", async (req: AuthedRequest, res) => {
  if (!(await hasPermission(req.user!.role, "SCHEDULE_MEETING"))) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  const parsed = meetingInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const meeting = await prisma.meeting.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      date: new Date(parsed.data.date),
      aiSystemId: parsed.data.aiSystemId || null,
      createdById: req.user!.userId,
    },
    include: { aiSystem: { select: { id: true, name: true } } },
  });

  await logAudit({
    entityType: "Meeting",
    entityId: meeting.id,
    aiSystemId: meeting.aiSystemId,
    action: "MEETING_SCHEDULED",
    actorId: req.user!.userId,
    summary: `Scheduled meeting "${meeting.title}" for ${meeting.date.toLocaleDateString()}.`,
  });

  res.status(201).json(meeting);
});

function canManageMeeting(req: AuthedRequest, createdById: string) {
  return req.user!.role === "ADMIN" || req.user!.userId === createdById;
}

const updateMeetingSchema = meetingInputSchema.partial();

meetingsRouter.patch("/meetings/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!canManageMeeting(req, existing.createdById)) {
    return res.status(403).json({ error: "Only the meeting's creator or an admin can edit it." });
  }

  const parsed = updateMeetingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const meeting = await prisma.meeting.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description || null }),
      ...(parsed.data.date !== undefined && { date: new Date(parsed.data.date) }),
      ...(parsed.data.aiSystemId !== undefined && { aiSystemId: parsed.data.aiSystemId || null }),
    },
    include: { aiSystem: { select: { id: true, name: true } } },
  });

  await logAudit({
    entityType: "Meeting",
    entityId: meeting.id,
    aiSystemId: meeting.aiSystemId,
    action: "MEETING_UPDATED",
    actorId: req.user!.userId,
    summary: `Updated meeting "${meeting.title}".`,
  });

  res.json(meeting);
});

meetingsRouter.delete("/meetings/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (!canManageMeeting(req, existing.createdById)) {
    return res.status(403).json({ error: "Only the meeting's creator or an admin can delete it." });
  }

  await prisma.meeting.delete({ where: { id: existing.id } });

  await logAudit({
    entityType: "Meeting",
    entityId: existing.id,
    aiSystemId: existing.aiSystemId,
    action: "MEETING_DELETED",
    actorId: req.user!.userId,
    summary: `Deleted meeting "${existing.title}".`,
  });

  res.status(204).end();
});
