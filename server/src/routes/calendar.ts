import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveRange } from "./meetings.js";

export const calendarRouter = Router();
calendarRouter.use(requireAuth);

type CalendarEventType = "MEETING" | "REASSESSMENT" | "DEPLOYMENT";

interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string;
  systemId: string | null;
  systemName: string | null;
  link: string | null;
}

calendarRouter.get("/calendar-events", async (req, res) => {
  const { from, to } = resolveRange(req.query.from as string | undefined, req.query.to as string | undefined);
  const range = { gte: from, lte: to };

  const [meetings, reassessments, deployments] = await Promise.all([
    prisma.meeting.findMany({
      where: { date: range },
      include: { aiSystem: { select: { id: true, name: true } } },
    }),
    prisma.aiSystem.findMany({
      where: { nextReviewDue: range },
      select: { id: true, name: true, nextReviewDue: true },
    }),
    prisma.aiSystem.findMany({
      where: { targetDeploymentDate: range },
      select: { id: true, name: true, targetDeploymentDate: true },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...meetings.map((m) => ({
      id: `meeting-${m.id}`,
      type: "MEETING" as const,
      title: m.title,
      date: m.date.toISOString(),
      systemId: m.aiSystemId,
      systemName: m.aiSystem?.name ?? null,
      link: m.aiSystemId ? `/systems/${m.aiSystemId}` : null,
    })),
    ...reassessments.map((s) => ({
      id: `reassessment-${s.id}`,
      type: "REASSESSMENT" as const,
      title: `${s.name} re-assessment due`,
      date: s.nextReviewDue!.toISOString(),
      systemId: s.id,
      systemName: s.name,
      link: `/systems/${s.id}`,
    })),
    ...deployments.map((s) => ({
      id: `deployment-${s.id}`,
      type: "DEPLOYMENT" as const,
      title: `${s.name} target deployment`,
      date: s.targetDeploymentDate!.toISOString(),
      systemId: s.id,
      systemName: s.name,
      link: `/systems/${s.id}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  res.json(events);
});
